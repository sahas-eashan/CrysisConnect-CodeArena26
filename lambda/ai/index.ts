import { Pool } from "pg";

type AppSyncEvent = {
  arguments: Record<string, any>;
  identity?: {
    sub?: string;
    claims?: Record<string, any>;
  };
  info: {
    fieldName: string;
    parentTypeName: string;
  };
};

type DbRow = Record<string, any>;

type AuditInsert = {
  action: string;
  role: string;
  userId: string | null;
  model: string;
  status: string;
  reviewStatus: string;
  confidence: number;
  sourceIds: string[];
  warnings: string[];
  riskFlags: {
    blocked: boolean;
    piiDetected: boolean;
    promptInjectionRisk: boolean;
    unsafeContent: boolean;
    reasons: string[];
  };
  latencyMs: number;
  tokenUsage: number | null;
};

type GeminiHttpError = Error & {
  statusCode?: number;
};

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 4
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const INTERACTIVE_MODEL = process.env.GEMINI_INTERACTIVE_MODEL ?? "gemini-2.5-flash";
const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-2.5-pro";
const WINDOW_MINUTES = Number(process.env.AI_RATE_LIMIT_WINDOW_MINUTES ?? 5);
const DEFAULT_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_DEFAULT ?? 10);
const CITIZEN_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_CITIZEN ?? 6);
const NGO_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_NGO ?? 10);
const GOVERNMENT_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_GOVERNMENT ?? 15);

function getGroups(event: AppSyncEvent) {
  const rawGroups = event.identity?.claims?.["cognito:groups"];
  if (Array.isArray(rawGroups)) return rawGroups as string[];
  if (typeof rawGroups === "string") return rawGroups.split(",").map((group) => group.trim()).filter(Boolean);
  return [];
}

function getRole(event: AppSyncEvent) {
  const groups = getGroups(event);
  if (groups.includes("government")) return "government";
  if (groups.includes("ngo")) return "ngo";
  return "citizen";
}

function getProfileRole(event: AppSyncEvent) {
  const groups = getGroups(event);
  if (groups.includes("government")) return "government";
  if (groups.includes("ngo")) return "ngo_org_member";
  if (groups.includes("ngo_org_member")) return "ngo_org_member";
  if (groups.includes("ngo_individual")) return "ngo_individual";

  const roleClaim = event.identity?.claims?.["custom:role"];
  if (
    roleClaim === "government" ||
    roleClaim === "ngo" ||
    roleClaim === "ngo_org_member" ||
    roleClaim === "ngo_individual" ||
    roleClaim === "citizen"
  ) {
    return roleClaim === "ngo" ? "ngo_org_member" : roleClaim;
  }

  return "citizen";
}

function getProfileName(event: AppSyncEvent, userId: string) {
  const claims = event.identity?.claims ?? {};
  const candidates = [claims.name, claims.email, claims.phone_number]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  return candidates[0] ?? `Citizen ${userId.slice(0, 8)}`;
}

function requireRole(event: AppSyncEvent, allowed: string[]) {
  const role = getRole(event);
  if (!allowed.includes(role)) {
    throw new Error("Unauthorized");
  }
  return role;
}

function requireUserId(event: AppSyncEvent) {
  return event.identity?.sub ?? null;
}

async function ensureProfile(event: AppSyncEvent, userId: string) {
  await pool.query(
    `INSERT INTO profiles (id, role, full_name, phone, email, is_available)
     VALUES ($1, $2::user_role, $3, $4, $5, true)
     ON CONFLICT (id) DO UPDATE
     SET role = CASE
           WHEN profiles.role = 'citizen'::user_role AND EXCLUDED.role <> 'citizen'::user_role THEN EXCLUDED.role
           ELSE profiles.role
         END,
         full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
         phone = COALESCE(profiles.phone, EXCLUDED.phone),
         email = COALESCE(profiles.email, EXCLUDED.email)`,
    [
      userId,
      getProfileRole(event),
      getProfileName(event, userId),
      typeof event.identity?.claims?.phone_number === "string" ? event.identity.claims.phone_number : null,
      typeof event.identity?.claims?.email === "string" ? event.identity.claims.email : null
    ]
  );
}

function looksLikePromptInjection(value: string) {
  const normalized = value.toLowerCase();
  return [
    "ignore previous instructions",
    "system prompt",
    "developer message",
    "reveal hidden",
    "override policy",
    "bypass",
    "disable guardrail"
  ].some((pattern) => normalized.includes(pattern));
}

function containsPii(value: string) {
  return /(\+?\d[\d\s-]{7,}\d)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(value);
}

function buildRiskFlags(text: string | null | undefined) {
  const value = text?.trim() ?? "";
  const piiDetected = value ? containsPii(value) : false;
  const promptInjectionRisk = value ? looksLikePromptInjection(value) : false;
  const blocked = promptInjectionRisk;
  const reasons = [
    ...(piiDetected ? ["Potential personal contact details detected."] : []),
    ...(promptInjectionRisk ? ["Potential prompt injection attempt detected in untrusted user text."] : [])
  ];

  return {
    blocked,
    piiDetected,
    promptInjectionRisk,
    unsafeContent: false,
    reasons
  };
}

function sourceIds(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
}

function aiMeta(
  audit: any,
  overrides: {
    status: string;
    confidence: number;
    sourceIds: string[];
    warnings: string[];
    requiresHumanApproval: boolean;
    riskFlags: AuditInsert["riskFlags"];
  }
) {
  return {
    status: overrides.status,
    confidence: overrides.confidence,
    sourceIds: overrides.sourceIds,
    warnings: overrides.warnings,
    requiresHumanApproval: overrides.requiresHumanApproval,
    audit,
    riskFlags: overrides.riskFlags
  };
}

function mapAudit(row: DbRow) {
  return {
    id: row.id,
    action: row.action,
    model: row.model,
    status: row.status,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    reviewStatus: row.review_status
  };
}

async function insertAuditLog(entry: AuditInsert) {
  const { rows } = await pool.query(
    `INSERT INTO ai_audit_logs (
      action, role, user_id, model, status, review_status, confidence, source_ids, warnings,
      blocked, pii_detected, prompt_injection_risk, unsafe_content, reasons, latency_ms, token_usage
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      entry.action,
      entry.role,
      entry.userId,
      entry.model,
      entry.status,
      entry.reviewStatus,
      entry.confidence,
      entry.sourceIds,
      entry.warnings,
      entry.riskFlags.blocked,
      entry.riskFlags.piiDetected,
      entry.riskFlags.promptInjectionRisk,
      entry.riskFlags.unsafeContent,
      entry.riskFlags.reasons,
      entry.latencyMs,
      entry.tokenUsage
    ]
  );

  return mapAudit(rows[0]);
}

async function enforceRateLimit(userId: string | null, role: string) {
  if (!userId) return;

  const limit =
    role === "citizen" ? CITIZEN_RATE_LIMIT : role === "ngo" ? NGO_RATE_LIMIT : role === "government" ? GOVERNMENT_RATE_LIMIT : DEFAULT_RATE_LIMIT;

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM ai_audit_logs
     WHERE user_id = $1
       AND created_at > now() - make_interval(mins => $2)`,
    [userId, WINDOW_MINUTES]
  );

  if ((rows[0]?.count ?? 0) >= limit) {
    throw new Error("AI rate limit exceeded for this user. Please wait before making another request.");
  }
}

async function queryOne<T extends DbRow>(text: string, values: any[] = []) {
  const { rows } = await pool.query(text, values);
  return (rows[0] ?? null) as T | null;
}

async function queryMany<T extends DbRow>(text: string, values: any[] = []) {
  const { rows } = await pool.query(text, values);
  return rows as T[];
}

function nearestSafeZoneGuidance(disaster: DbRow | null, safeZone: DbRow | null, resources: DbRow[]) {
  const resource = resources[0] ?? null;
  const title = disaster?.title ? `Safety guidance for ${disaster.title}` : "Safety guidance for your area";
  return {
    title,
    safeZoneId: safeZone?.id ?? null,
    resourceIds: resource ? [resource.id] : [],
    nextSteps: [
      safeZone ? `Move toward ${safeZone.name} if travel is safe.` : "Move toward the nearest verified safe zone if travel is safe.",
      "Avoid flooded roads and follow official instructions.",
      "Use bottled or boiled water only."
    ],
    guidance: {
      english: safeZone
        ? `Move toward ${safeZone.name} if it is safe to travel. Avoid flooded roads and use boiled or bottled water only.`
        : "Move toward the nearest verified safe zone if it is safe to travel. Avoid flooded roads and use boiled or bottled water only.",
      sinhala: safeZone
        ? `${safeZone.name} වෙත ගමන් කිරීම ආරක්ෂිත නම් එම ස්ථානය වෙත යන්න. ජලයෙන් වැසුණු මාර්ග වලින් වළකින්න සහ තැම්බූ හෝ බෝතල් ජලය පමණක් භාවිතා කරන්න.`
        : "ගමන් කිරීම ආරක්ෂිත නම් ආසන්නයේ ඇති සත්‍යාපිත ආරක්ෂිත ස්ථානය වෙත යන්න. ජලයෙන් වැසුණු මාර්ග වලින් වළකින්න සහ තැම්බූ හෝ බෝතල් ජලය පමණක් භාවිතා කරන්න.",
      tamil: safeZone
        ? `பாதுகாப்பாக பயணம் செய்ய முடிந்தால் ${safeZone.name} நோக்கி செல்லுங்கள். வெள்ளமான சாலைகளை தவிர்த்து, காய்ச்சிய அல்லது பாட்டில் தண்ணீரை மட்டும் பயன்படுத்துங்கள்.`
        : "பாதுகாப்பாக பயணம் செய்ய முடிந்தால் அருகிலுள்ள சரிபார்க்கப்பட்ட பாதுகாப்பு மையத்திற்குச் செல்லுங்கள். வெள்ளமான சாலைகளை தவிர்த்து, காய்ச்சிய அல்லது பாட்டில் தண்ணீரை மட்டும் பயன்படுத்துங்கள்."
    }
  };
}

function fallbackPreparedSos(input: { type: string; description: string }) {
  const trimmed = input.description.trim();
  const refined = `${input.type.toUpperCase()} emergency: ${trimmed.endsWith(".") ? trimmed : `${trimmed}.`} Immediate responder review requested.`;
  return {
    original: input.description,
    refined,
    checklist: [
      "Review the summary before sending.",
      "Keep location services enabled.",
      "Call emergency services directly if immediate danger escalates."
    ],
    translations: {
      english: refined,
      sinhala: `${input.type.toUpperCase()} හදිසි තත්ත්වය: ${trimmed}. වහාම ප්‍රතිචාරක පරීක්ෂාව අවශ්‍යයි.`,
      tamil: `${input.type.toUpperCase()} அவசரநிலை: ${trimmed}. உடனடி மீட்பாளர் மதிப்பாய்வு தேவை.`
    }
  };
}

function fallbackIncidentBrief(context: {
  disaster: DbRow | null;
  safeZones: DbRow[];
  resources: DbRow[];
  sosSignals: DbRow[];
}) {
  const occupancy = context.safeZones.reduce((sum, zone) => sum + Number(zone.current_occupancy ?? 0), 0);
  const capacity = context.safeZones.reduce((sum, zone) => sum + Number(zone.capacity ?? 0), 0);
  const occupancyPercent = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
  return {
    headline: context.disaster?.title
      ? `${context.disaster.title}: command attention should stay on evacuation and shelter pressure.`
      : "Active incident analysis generated from live crisis data.",
    summary:
      context.disaster?.description ??
      "AI fallback summary generated from active disaster, safe zone, resource, and SOS records.",
    rationale: {
      summary: "This brief is grounded in active crisis records already stored in CrisisConnect.",
      bullets: [
        `Tracked safe zone occupancy is ${occupancyPercent}% across active shelters.`,
        `${context.sosSignals.length} active SOS signals were considered for urgency.`,
        `${context.resources.length} tracked resource records were included in the assessment.`
      ]
    },
    recommendations: [
      {
        title: "Protect shelter capacity",
        detail: "Prepare overflow shelter options before current sites approach saturation.",
        priority: "high"
      },
      {
        title: "Stage evacuation support",
        detail: "Keep the nearest responders focused on high-risk SOS cases until flood conditions stabilize.",
        priority: "high"
      }
    ],
    translations: {
      english: "Flood pressure is increasing. Protect shelter capacity and keep evacuation support ready.",
      sinhala: "ගංවතුර පීඩනය වැඩි වෙමින් පවතී. ආරක්ෂිත නවාතැන් ධාරිතාව ආරක්ෂා කර ඉවත් කිරීමේ සහාය සූදානම් තබන්න.",
      tamil: "வெள்ள அழுத்தம் அதிகரிக்கிறது. பாதுகாப்பு மைய திறனை காக்கவும், வெளியேற்ற உதவியை தயார் நிலையில் வைத்திருக்கவும்."
    }
  };
}

function fallbackAlertDraft(input: any, disaster: DbRow | null) {
  const title = input.title || disaster?.title || "Emergency Alert";
  return {
    title,
    channel: Array.isArray(input.channel) ? input.channel : ["push"],
    rationale: {
      summary: "The draft keeps language simple, location-aware, and suitable for fast approval.",
      bullets: [
        "Draft includes direct action instructions instead of speculative details.",
        "Multilingual variants mirror the same public safety meaning."
      ]
    },
    english: `${title}: ${input.body} Move to the nearest safe zone shown in CrisisConnect if travel is safe.`,
    sinhala: `${title}: ${input.body} ගමන් කිරීම ආරක්ෂිත නම් CrisisConnect හි පෙන්වන ආසන්නතම ආරක්ෂිත ස්ථානය වෙත යන්න.`,
    tamil: `${title}: ${input.body} பாதுகாப்பாக பயணம் செய்ய முடிந்தால் CrisisConnect இல் காட்டப்படும் அருகிலுள்ள பாதுகாப்பு மையத்திற்குச் செல்லுங்கள்.`
  };
}

function fallbackOperations(context: { sosSignals: DbRow[]; resources: DbRow[]; safeZones: DbRow[] }, timeframe: string) {
  const lowResources = context.resources.filter((resource) => (resource.status ?? "").toLowerCase() === "low");
  return {
    timeframe,
    rationale: {
      summary: "Operations are ranked using SOS urgency, low inventory signals, and shelter utilization.",
      bullets: [
        `${context.sosSignals.length} active SOS records were considered.`,
        `${lowResources.length} low-stock resources need near-term review.`
      ]
    },
    recommendations: [
      {
        title: "Clear the highest-risk SOS backlog",
        detail: "Keep the nearest available responders focused on evacuation and medical calls first.",
        priority: "critical"
      },
      {
        title: "Rebalance low medical stock",
        detail: "Shift low first-aid inventory toward the most pressured shelters within the next shift.",
        priority: "high"
      }
    ]
  };
}

function fallbackSosTriage(sos: DbRow | null, responders: DbRow[]) {
  return {
    sosId: sos?.id ?? null,
    severity: "high",
    urgency: "immediate",
    responderIds: responders.map((row) => String(row.id)),
    rationale: {
      summary: "The SOS description and nearby responder availability indicate urgent review.",
      bullets: [
        "Potential evacuation risk was detected in the SOS narrative.",
        "Nearby responder availability supports immediate human review and dispatch."
      ]
    },
    recommendations: [
      {
        title: "Confirm evacuation status",
        detail: "Contact the reporting citizen if possible and validate whether rising water or injury is worsening.",
        priority: "critical"
      }
    ]
  };
}

function fallbackResourceDispatch(request: DbRow | null, resources: DbRow[]) {
  const candidate = resources[0];
  return {
    requestId: request?.id ?? null,
    rationale: {
      summary: "The suggested dispatch bundles the nearest suitable inventory with the pending request.",
      bullets: [
        candidate ? `${candidate.name} is the closest relevant available resource.` : "No single ideal inventory match was found.",
        "Human review is still required before field dispatch."
      ]
    },
    recommendations: [
      {
        title: candidate ? `Dispatch ${candidate.name}` : "Review substitute inventory",
        detail: candidate
          ? `Use ${candidate.name} as the first response bundle for the pending citizen request.`
          : "Review nearby depots for a substitute bundle that satisfies the pending request.",
        priority: "high"
      }
    ]
  };
}

function createSchemaInstruction(schema: Record<string, unknown>) {
  return JSON.stringify(schema);
}

function mapSchemaPrimitive(value: string) {
  if (value === "string|null") {
    return {
      type: "string",
      nullable: true
    };
  }

  if (["string", "number", "integer", "boolean", "null"].includes(value)) {
    return { type: value };
  }

  return { type: "string" };
}

function toGeminiSchema(schema: unknown): Record<string, unknown> {
  if (Array.isArray(schema)) {
    return {
      type: "array",
      items: toGeminiSchema(schema[0] ?? "string")
    };
  }

  if (typeof schema === "string") {
    return mapSchemaPrimitive(schema);
  }

  if (schema && typeof schema === "object") {
    const entries = Object.entries(schema);
    return {
      type: "object",
      properties: Object.fromEntries(entries.map(([key, value]) => [key, toGeminiSchema(value)])),
      required: entries.map(([key]) => key)
    };
  }

  return { type: "string" };
}

function extractJsonText(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    if (withoutFence) return withoutFence;
  }

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1);
  }

  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) {
    return trimmed.slice(firstArray, lastArray + 1);
  }

  return trimmed;
}

async function callGemini<T>({
  taskName,
  model,
  systemInstruction,
  prompt,
  schema
}: {
  taskName: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  schema: Record<string, unknown>;
}) {
  if (!GEMINI_API_KEY) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${prompt}\n\nReturn JSON only. Follow this schema exactly:\n${createSchemaInstruction(schema)}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(schema)
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
        ]
      })
    }
  );

  if (!response.ok) {
    const details = await response.text();
    console.error(
      JSON.stringify({
        level: "error",
        taskName,
        model,
        event: "gemini_http_error",
        statusCode: response.status,
        details: details.slice(0, 600)
      })
    );
    const error = new Error(`Gemini request failed with ${response.status}`) as GeminiHttpError;
    error.statusCode = response.status;
    throw error;
  }

  const payload = (await response.json()) as any;
  const finishReason = payload.candidates?.[0]?.finishReason ?? null;
  const text = payload.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? "").join("")?.trim();
  if (!text) {
    console.warn(
      JSON.stringify({
        level: "warn",
        taskName,
        model,
        event: "gemini_empty_response",
        finishReason,
        promptFeedback: payload.promptFeedback ?? null
      })
    );
    return null;
  }

  try {
    const normalizedText = extractJsonText(text);
    const parsed = JSON.parse(normalizedText) as T;
    console.log(
      JSON.stringify({
        level: "info",
        taskName,
        model,
        event: "gemini_completed",
        finishReason
      })
    );
    return parsed;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        taskName,
        model,
        event: "gemini_parse_error",
        finishReason,
        rawText: text.slice(0, 600),
        message: error instanceof Error ? error.message : "Unknown parse error"
      })
    );
    throw error;
  }
}

function isGeminiQuotaError(error: unknown) {
  return typeof (error as GeminiHttpError | undefined)?.statusCode === "number" && (error as GeminiHttpError).statusCode === 429;
}

function toAiErrorMessage(action: string, error: unknown) {
  if (isGeminiQuotaError(error)) {
    return `Live AI is temporarily unavailable for ${action} because the current Gemini quota has been exceeded.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return `Live AI failed while running ${action}.`;
}

function ensureStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stripRawRecordReferences(value: string) {
  return value
    .replace(/\(ID:\s*([^)]+)\)/gi, "")
    .replace(/\bIDs?:\s*[0-9a-f,\s-]{36,}/gi, "")
    .replace(/\(([0-9a-f,\s-]{36,})\)/gi, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function validateRecommendationList(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.title === "string" && typeof item.detail === "string")
    .map((item) => ({
      title: stripRawRecordReferences(String(item.title)),
      detail: stripRawRecordReferences(String(item.detail)),
      priority: typeof item.priority === "string" ? item.priority : "medium",
      relatedIds: ensureStringArray(item.relatedIds)
    }));
}

function deriveOperationRecommendationIds(
  recommendation: { title: string; detail: string; relatedIds?: string[] },
  context: { sosSignals: DbRow[]; resources: DbRow[]; safeZones: DbRow[] }
) {
  if (recommendation.relatedIds?.length) {
    return recommendation.relatedIds;
  }

  const text = `${recommendation.title} ${recommendation.detail}`.toLowerCase();
  const ids = new Set<string>();

  if (/(sos|evac|rescue|responder|assignment|trapped|medical emergency)/.test(text)) {
    context.sosSignals.slice(0, 3).forEach((signal) => ids.add(String(signal.id)));
  }

  if (/(resource|stock|supply|inventory|food|water|medical kit|medical suppl|aid)/.test(text)) {
    context.resources.slice(0, 3).forEach((resource) => ids.add(String(resource.id)));
  }

  if (/(shelter|safe zone|capacity|occupancy|camp)/.test(text)) {
    context.safeZones.slice(0, 3).forEach((zone) => ids.add(String(zone.id)));
  }

  return [...ids];
}

function validateTranslations(value: any) {
  return {
    english: typeof value?.english === "string" ? value.english : "",
    sinhala: typeof value?.sinhala === "string" ? value.sinhala : "",
    tamil: typeof value?.tamil === "string" ? value.tamil : ""
  };
}

function validateRationale(value: any) {
  return {
    summary: typeof value?.summary === "string" ? value.summary : "",
    bullets: ensureStringArray(value?.bullets)
  };
}

async function generateCitizenGuidance(event: AppSyncEvent) {
  const role = requireRole(event, ["citizen", "ngo", "government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const startedAt = Date.now();

  const currentDisaster = await queryOne(
    `SELECT id, title, description FROM disasters
     WHERE status = 'active'
       AND ($1::uuid IS NULL OR id = $1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [event.arguments.disasterId ?? null]
  );

  const profile = userId
    ? await queryOne(
        `SELECT ST_AsGeoJSON(location) AS location
         FROM profiles WHERE id = $1 LIMIT 1`,
        [userId]
      )
    : null;

  const safeZone = profile?.location
    ? await queryOne(
        `SELECT id, name
         FROM safe_zones
         WHERE status = 'active'
         ORDER BY ST_Distance(location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography)
         LIMIT 1`,
        [profile.location]
      )
    : await queryOne(`SELECT id, name FROM safe_zones WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`);

  const resources = await queryMany(
    `SELECT id, name
     FROM resources
     WHERE status IN ('available', 'low')
     ORDER BY created_at DESC
     LIMIT 2`
  );

  const warnings = ["AI guidance is advisory. Follow official emergency instructions when they differ."];
  const riskFlags = buildRiskFlags(null);
  const sourceIdList = sourceIds(currentDisaster?.id, safeZone?.id, ...resources.map((resource) => resource.id));
  const tokenUsage: number | null = null;

  try {
    const generated = await callGemini<ReturnType<typeof nearestSafeZoneGuidance>>({
      taskName: "getCitizenGuidance",
      model: INTERACTIVE_MODEL,
      systemInstruction:
        "You are a safety-focused disaster assistant. Use only the structured CrisisConnect context provided. Do not invent shelters, resources, or capabilities. Keep language clear, calm, and concise.",
      prompt: JSON.stringify({
        task: "citizen_guidance",
        role,
        context: {
          currentDisaster,
          safeZone,
          resources
        }
      }),
      schema: {
        title: "string",
        safeZoneId: "string|null",
        resourceIds: ["string"],
        nextSteps: ["string"],
        guidance: {
          english: "string",
          sinhala: "string",
          tamil: "string"
        }
      }
    });

    if (!generated || typeof generated.title !== "string") {
      throw new Error("Live AI returned an invalid citizen guidance payload.");
    }

    const payload = {
      title: generated.title,
      safeZoneId: typeof generated.safeZoneId === "string" ? generated.safeZoneId : safeZone?.id ?? null,
      resourceIds: ensureStringArray((generated as any).resourceIds),
      nextSteps: ensureStringArray((generated as any).nextSteps),
      guidance: validateTranslations((generated as any).guidance)
    };

    const audit = await insertAuditLog({
      action: "getCitizenGuidance",
      role,
      userId,
      model: INTERACTIVE_MODEL,
      status: "completed",
      reviewStatus: "not_required",
      confidence: 0.86,
      sourceIds: sourceIdList,
      warnings,
      riskFlags,
      latencyMs: Date.now() - startedAt,
      tokenUsage
    });

    return {
      ...payload,
      meta: aiMeta(audit, {
        status: "completed",
        confidence: 0.86,
        sourceIds: sourceIdList,
        warnings,
        requiresHumanApproval: false,
        riskFlags
      })
    };
  } catch (error) {
    throw new Error(toAiErrorMessage("citizen guidance", error));
  }
}

async function generatePreparedSos(event: AppSyncEvent) {
  const role = requireRole(event, ["citizen", "ngo", "government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const input = {
    type: String(event.arguments.input?.type ?? "general"),
    description: String(event.arguments.input?.description ?? "").trim()
  };
  const startedAt = Date.now();
  const riskFlags = buildRiskFlags(input.description);
  const warnings = ["Review the AI-prepared SOS before sending it to responders."];

  let payload = fallbackPreparedSos(input);
  let status = riskFlags.blocked ? "blocked" : "completed";
  let confidence = riskFlags.blocked ? 0.15 : 0.83;

  if (!riskFlags.blocked) {
    try {
      const generated = await callGemini<typeof payload>({
        taskName: "prepareSosSubmission",
        model: INTERACTIVE_MODEL,
        systemInstruction:
          "You are preparing an SOS summary for emergency responders. Preserve facts, remove hype, do not invent injuries or hazards, and keep the summary concise and operational.",
        prompt: JSON.stringify({
          task: "prepare_sos_submission",
          role,
          trustedPolicy: {
            noPromptOverride: true,
            noUnverifiedClaims: true
          },
          untrustedUserText: input.description,
          sosType: input.type
        }),
        schema: {
          original: "string",
          refined: "string",
          checklist: ["string"],
          translations: {
            english: "string",
            sinhala: "string",
            tamil: "string"
          }
        }
      });

      if (generated && typeof generated.refined === "string") {
        payload = {
          original: typeof generated.original === "string" ? generated.original : input.description,
          refined: generated.refined,
          checklist: ensureStringArray((generated as any).checklist),
          translations: validateTranslations((generated as any).translations)
        };
      } else {
        throw new Error("Live AI returned an invalid SOS preparation payload.");
      }
    } catch (error) {
      throw new Error(toAiErrorMessage("SOS preparation", error));
    }
  } else {
    warnings.push("Potential prompt injection content was detected. CrisisConnect blocked model rewriting and used a safe fallback summary.");
  }

  const audit = await insertAuditLog({
    action: "prepareSosSubmission",
    role,
    userId,
    model: INTERACTIVE_MODEL,
    status,
    reviewStatus: "pending_review",
    confidence,
    sourceIds: [],
    warnings,
    riskFlags,
    latencyMs: Date.now() - startedAt,
    tokenUsage: null
  });

  return {
    ...payload,
    meta: aiMeta(audit, {
      status,
      confidence,
      sourceIds: [],
      warnings,
      requiresHumanApproval: true,
      riskFlags
    })
  };
}

async function generateIncidentBrief(event: AppSyncEvent) {
  const role = requireRole(event, ["government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const startedAt = Date.now();

  const disaster = await queryOne(
    `SELECT id, title, description, severity, secondary_risks
     FROM disasters
     WHERE status = 'active'
       AND ($1::uuid IS NULL OR id = $1)
     ORDER BY created_at DESC
     LIMIT 1`,
    [event.arguments.disasterId ?? null]
  );
  const safeZones = await queryMany(
    `SELECT id, name, capacity, current_occupancy
     FROM safe_zones
     WHERE ($1::uuid IS NULL OR disaster_id = $1)
     ORDER BY created_at DESC
     LIMIT 6`,
    [disaster?.id ?? null]
  );
  const resources = await queryMany(
    `SELECT id, name, status
     FROM resources
     WHERE ($1::uuid IS NULL OR disaster_id = $1)
     ORDER BY created_at DESC
     LIMIT 8`,
    [disaster?.id ?? null]
  );
  const sosSignals = await queryMany(
    `SELECT id, type, status
     FROM sos_signals
     WHERE ($1::uuid IS NULL OR disaster_id = $1)
       AND status IN ('pending', 'assigned', 'in_progress')
     ORDER BY created_at DESC
     LIMIT 8`,
    [disaster?.id ?? null]
  );

  const sourceIdList = sourceIds(
    disaster?.id,
    ...safeZones.map((zone) => zone.id),
    ...resources.map((resource) => resource.id),
    ...sosSignals.map((signal) => signal.id)
  );
  const warnings = ["AI-generated command briefs require duty-officer review before operational action."];
  const riskFlags = buildRiskFlags(null);
  let modelUsed = ANALYSIS_MODEL;

  try {
    const request = {
      taskName: "generateIncidentBrief",
      model: ANALYSIS_MODEL,
      systemInstruction:
        "You are a government disaster command copilot. Use only the structured CrisisConnect data provided. Do not speculate, do not issue public promises, and keep recommendations operational and reviewable.",
      prompt: JSON.stringify({
        task: "incident_brief",
        context: {
          disaster,
          safeZones,
          resources,
          sosSignals
        }
      }),
      schema: {
        headline: "string",
        summary: "string",
        rationale: {
          summary: "string",
          bullets: ["string"]
        },
        recommendations: [
          {
            title: "string",
            detail: "string",
            priority: "string"
          }
        ],
        translations: {
          english: "string",
          sinhala: "string",
          tamil: "string"
        }
      }
    } as const;

    let generated: ReturnType<typeof fallbackIncidentBrief> | null = null;

    try {
      generated = await callGemini<ReturnType<typeof fallbackIncidentBrief>>(request);
    } catch (error) {
      if (!isGeminiQuotaError(error) || ANALYSIS_MODEL === INTERACTIVE_MODEL) {
        throw error;
      }

      modelUsed = INTERACTIVE_MODEL;
      warnings.push(`Primary analysis model quota was unavailable, so CrisisConnect retried with ${INTERACTIVE_MODEL}.`);
      generated = await callGemini<ReturnType<typeof fallbackIncidentBrief>>({
        ...request,
        model: INTERACTIVE_MODEL
      });
    }

    if (generated && typeof generated.headline === "string") {
      const payload = {
        headline: generated.headline,
        summary: typeof generated.summary === "string" ? generated.summary : "",
        rationale: validateRationale((generated as any).rationale),
        recommendations: validateRecommendationList((generated as any).recommendations),
        translations: validateTranslations((generated as any).translations)
      };

      const audit = await insertAuditLog({
        action: "generateIncidentBrief",
        role,
        userId,
        model: modelUsed,
        status: "completed",
        reviewStatus: "pending_review",
        confidence: 0.89,
        sourceIds: sourceIdList,
        warnings,
        riskFlags,
        latencyMs: Date.now() - startedAt,
        tokenUsage: null
      });

      return {
        ...payload,
        meta: aiMeta(audit, {
          status: "completed",
          confidence: 0.89,
          sourceIds: sourceIdList,
          warnings,
          requiresHumanApproval: true,
          riskFlags
        })
      };
    }
    throw new Error("Live AI returned an invalid incident brief payload.");
  } catch (error) {
    throw new Error(toAiErrorMessage("incident brief generation", error));
  }
}

async function generateAlertDraft(event: AppSyncEvent) {
  const role = requireRole(event, ["government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const startedAt = Date.now();
  const input = event.arguments.input ?? {};
  const riskFlags = buildRiskFlags(String(input.body ?? ""));
  const disaster = input.disasterId
    ? await queryOne(`SELECT id, title, severity FROM disasters WHERE id = $1 LIMIT 1`, [input.disasterId])
    : await queryOne(`SELECT id, title, severity FROM disasters WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`);
  const warnings = ["Human approval is mandatory before any AI-generated alert is broadcast."];

  let payload = fallbackAlertDraft(input, disaster);
  let status = riskFlags.blocked ? "blocked" : "completed";
  let confidence = riskFlags.blocked ? 0.18 : 0.86;

  if (!riskFlags.blocked) {
    try {
      const generated = await callGemini<typeof payload>({
        taskName: "generateAlertDraft",
        model: INTERACTIVE_MODEL,
        systemInstruction:
          "You are drafting a multilingual government safety alert. Keep instructions concrete, calm, and suitable for review. Do not add unsupported claims or evacuation promises.",
        prompt: JSON.stringify({
          task: "alert_draft",
          context: {
            disaster,
            requestedTitle: input.title,
            requestedBody: input.body,
            channels: input.channel,
            targetRoles: input.targetRoles
          }
        }),
        schema: {
          title: "string",
          channel: ["string"],
          rationale: {
            summary: "string",
            bullets: ["string"]
          },
          english: "string",
          sinhala: "string",
          tamil: "string"
        }
      });

      if (generated && typeof generated.title === "string") {
        payload = {
          title: generated.title,
          channel: ensureStringArray((generated as any).channel),
          rationale: validateRationale((generated as any).rationale),
          english: typeof generated.english === "string" ? generated.english : payload.english,
          sinhala: typeof generated.sinhala === "string" ? generated.sinhala : payload.sinhala,
          tamil: typeof generated.tamil === "string" ? generated.tamil : payload.tamil
        };
      } else {
        throw new Error("Live AI returned an invalid alert draft payload.");
      }
    } catch (error) {
      throw new Error(toAiErrorMessage("alert drafting", error));
    }
  } else {
    warnings.push("Potential prompt injection content was detected in the alert draft input. The model response was blocked.");
  }

  const audit = await insertAuditLog({
    action: "generateAlertDraft",
    role,
    userId,
    model: INTERACTIVE_MODEL,
    status,
    reviewStatus: "pending_review",
    confidence,
    sourceIds: sourceIds(disaster?.id),
    warnings,
    riskFlags,
    latencyMs: Date.now() - startedAt,
    tokenUsage: null
  });

  return {
    ...payload,
    meta: aiMeta(audit, {
      status,
      confidence,
      sourceIds: sourceIds(disaster?.id),
      warnings,
      requiresHumanApproval: true,
      riskFlags
    })
  };
}

async function recommendOperations(event: AppSyncEvent) {
  const role = requireRole(event, ["government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const startedAt = Date.now();
  const timeframe = typeof event.arguments.timeframe === "string" && event.arguments.timeframe ? event.arguments.timeframe : "next_6_hours";

  const safeZones = await queryMany(`SELECT id, name, capacity, current_occupancy FROM safe_zones WHERE status = 'active'`);
  const resources = await queryMany(`SELECT id, name, status FROM resources ORDER BY created_at DESC LIMIT 10`);
  const sosSignals = await queryMany(
    `SELECT id, type, status
     FROM sos_signals
     WHERE status IN ('pending', 'assigned', 'in_progress')
     ORDER BY created_at DESC
     LIMIT 10`
  );
  const warnings = ["Operational recommendations are advisory and require command review."];
  const riskFlags = buildRiskFlags(null);

  try {
    const generated = await callGemini<ReturnType<typeof fallbackOperations>>({
      taskName: "recommendOperations",
      model: INTERACTIVE_MODEL,
      systemInstruction:
        "You are ranking disaster command actions for the next shift. Use only the structured data provided, avoid unsupported certainty, prefer operationally practical steps, and never print raw UUIDs or record IDs in the visible title or detail. Put any case references in relatedIds only.",
      prompt: JSON.stringify({
        task: "recommend_operations",
        timeframe,
        context: {
          safeZones,
          resources,
          sosSignals
        }
      }),
      schema: {
        timeframe: "string",
        rationale: {
          summary: "string",
          bullets: ["string"]
        },
        recommendations: [
          {
            title: "string",
            detail: "string",
            priority: "string",
            relatedIds: ["string"]
          }
        ]
      }
    });

    if (generated) {
      const payload = {
        timeframe: typeof (generated as any).timeframe === "string" ? (generated as any).timeframe : timeframe,
        rationale: validateRationale((generated as any).rationale),
        recommendations: validateRecommendationList((generated as any).recommendations).map((recommendation) => ({
          ...recommendation,
          relatedIds: deriveOperationRecommendationIds(recommendation, {
            sosSignals,
            resources,
            safeZones
          })
        }))
      };

      const sources = sourceIds(...safeZones.map((zone) => zone.id), ...resources.map((resource) => resource.id), ...sosSignals.map((signal) => signal.id));
      const audit = await insertAuditLog({
        action: "recommendOperations",
        role,
        userId,
        model: INTERACTIVE_MODEL,
        status: "completed",
        reviewStatus: "pending_review",
        confidence: 0.85,
        sourceIds: sources,
        warnings,
        riskFlags,
        latencyMs: Date.now() - startedAt,
        tokenUsage: null
      });

      return {
        ...payload,
        meta: aiMeta(audit, {
          status: "completed",
          confidence: 0.85,
          sourceIds: sources,
          warnings,
          requiresHumanApproval: true,
          riskFlags
        })
      };
    }
    throw new Error("Live AI returned an invalid operations recommendation payload.");
  } catch (error) {
    throw new Error(toAiErrorMessage("operations recommendation", error));
  }
}

async function triageSosCase(event: AppSyncEvent) {
  const role = requireRole(event, ["ngo", "government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const startedAt = Date.now();

  const sos = await queryOne(
    `SELECT id, type, description, ST_AsGeoJSON(location) AS location
     FROM sos_signals
     WHERE id = $1
     LIMIT 1`,
    [event.arguments.id]
  );

  const responders = sos?.location
    ? await queryMany(
        `SELECT id, full_name,
                ST_Distance(location, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) AS distance
         FROM profiles
         WHERE role IN ('ngo_individual', 'ngo_org_member')
           AND is_available = true
           AND location IS NOT NULL
         ORDER BY distance ASC
         LIMIT 3`,
        [sos.location]
      )
    : [];

  const riskFlags = buildRiskFlags(String(sos?.description ?? ""));
  const warnings = ["Responder assignment remains a human approval action."];
  let payload = fallbackSosTriage(sos, responders);
  let status = riskFlags.blocked ? "blocked" : "completed";
  let confidence = riskFlags.blocked ? 0.2 : 0.84;

  if (!riskFlags.blocked) {
    try {
      const generated = await callGemini<typeof payload>({
        taskName: "triageSosCase",
        model: INTERACTIVE_MODEL,
        systemInstruction:
          "You are triaging an SOS for NGO responders. Keep severity defensible, avoid medical diagnosis, and recommend only reviewable actions.",
        prompt: JSON.stringify({
          task: "triage_sos_case",
          context: {
            sos,
            responders
          }
        }),
        schema: {
          sosId: "string|null",
          severity: "string",
          urgency: "string",
          responderIds: ["string"],
          rationale: {
            summary: "string",
            bullets: ["string"]
          },
          recommendations: [
            {
              title: "string",
              detail: "string",
              priority: "string"
            }
          ]
        }
      });

      if (generated) {
        payload = {
          sosId: typeof (generated as any).sosId === "string" ? (generated as any).sosId : sos?.id ?? null,
          severity: typeof (generated as any).severity === "string" ? (generated as any).severity : payload.severity,
          urgency: typeof (generated as any).urgency === "string" ? (generated as any).urgency : payload.urgency,
          responderIds: ensureStringArray((generated as any).responderIds),
          rationale: validateRationale((generated as any).rationale),
          recommendations: validateRecommendationList((generated as any).recommendations)
        };
      } else {
        throw new Error("Live AI returned an invalid SOS triage payload.");
      }
    } catch (error) {
      throw new Error(toAiErrorMessage("SOS triage", error));
    }
  } else {
    warnings.push("Potential prompt injection content was detected in the SOS narrative. The model output was blocked.");
  }

  const audit = await insertAuditLog({
    action: "triageSosCase",
    role,
    userId,
    model: INTERACTIVE_MODEL,
    status,
    reviewStatus: "pending_review",
    confidence,
    sourceIds: sourceIds(sos?.id, ...responders.map((responder) => responder.id)),
    warnings,
    riskFlags,
    latencyMs: Date.now() - startedAt,
    tokenUsage: null
  });

  return {
    ...payload,
    meta: aiMeta(audit, {
      status,
      confidence,
      sourceIds: sourceIds(sos?.id, ...responders.map((responder) => responder.id)),
      warnings,
      requiresHumanApproval: true,
      riskFlags
    })
  };
}

async function recommendResourceDispatch(event: AppSyncEvent) {
  const role = requireRole(event, ["ngo", "government"]);
  const userId = requireUserId(event);
  await enforceRateLimit(userId, role);
  const startedAt = Date.now();

  const request = await queryOne(
    `SELECT id, resource_name, urgency, ST_AsGeoJSON(location) AS location
     FROM resource_requests
     WHERE id = $1
     LIMIT 1`,
    [event.arguments.id]
  );

  const resources = await queryMany(`SELECT id, name, status FROM resources WHERE status IN ('available', 'low') ORDER BY created_at DESC LIMIT 5`);
  const warnings = ["Dispatch suggestions require human confirmation and inventory validation."];
  const riskFlags = buildRiskFlags(String(request?.resource_name ?? ""));
  let payload = fallbackResourceDispatch(request, resources);
  let status = riskFlags.blocked ? "blocked" : "completed";
  let confidence = riskFlags.blocked ? 0.2 : 0.82;

  if (!riskFlags.blocked) {
    try {
      const generated = await callGemini<typeof payload>({
        taskName: "recommendResourceDispatch",
        model: INTERACTIVE_MODEL,
        systemInstruction:
          "You are recommending a resource dispatch plan for NGO field teams. Use only the structured context, avoid claiming stock certainty, and keep the plan easy to review.",
        prompt: JSON.stringify({
          task: "recommend_resource_dispatch",
          context: {
            request,
            resources
          }
        }),
        schema: {
          requestId: "string|null",
          rationale: {
            summary: "string",
            bullets: ["string"]
          },
          recommendations: [
            {
              title: "string",
              detail: "string",
              priority: "string"
            }
          ]
        }
      });

      if (generated) {
        payload = {
          requestId: typeof (generated as any).requestId === "string" ? (generated as any).requestId : request?.id ?? null,
          rationale: validateRationale((generated as any).rationale),
          recommendations: validateRecommendationList((generated as any).recommendations)
        };
      } else {
        throw new Error("Live AI returned an invalid resource dispatch payload.");
      }
    } catch (error) {
      throw new Error(toAiErrorMessage("resource dispatch planning", error));
    }
  }

  const audit = await insertAuditLog({
    action: "recommendResourceDispatch",
    role,
    userId,
    model: INTERACTIVE_MODEL,
    status,
    reviewStatus: "pending_review",
    confidence,
    sourceIds: sourceIds(request?.id, ...resources.map((resource) => resource.id)),
    warnings,
    riskFlags,
    latencyMs: Date.now() - startedAt,
    tokenUsage: null
  });

  return {
    ...payload,
    meta: aiMeta(audit, {
      status,
      confidence,
      sourceIds: sourceIds(request?.id, ...resources.map((resource) => resource.id)),
      warnings,
      requiresHumanApproval: true,
      riskFlags
    })
  };
}

async function getAiAuditLogs(event: AppSyncEvent) {
  requireRole(event, ["government"]);
  const limit = Math.min(Number(event.arguments.limit ?? 20), 50);
  const rows = await queryMany(
    `SELECT * FROM ai_audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(mapAudit);
}

async function reviewAiAuditLog(event: AppSyncEvent) {
  requireRole(event, ["government"]);

  const reviewStatus = event.arguments.approved ? "approved" : "rejected";
  const { rows } = await pool.query(
    `UPDATE ai_audit_logs
     SET review_status = $2
     WHERE id = $1
     RETURNING *`,
    [event.arguments.id, reviewStatus]
  );

  if (!rows[0]) {
    throw new Error("AI audit record not found.");
  }

  return mapAudit(rows[0]);
}

export async function handler(event: AppSyncEvent) {
  const userId = requireUserId(event);
  if (userId) {
    await ensureProfile(event, userId);
  }

  switch (event.info.fieldName) {
    case "getCitizenGuidance":
      return generateCitizenGuidance(event);
    case "getAiAuditLogs":
      return getAiAuditLogs(event);
    case "reviewAiAuditLog":
      return reviewAiAuditLog(event);
    case "prepareSosSubmission":
      return generatePreparedSos(event);
    case "generateIncidentBrief":
      return generateIncidentBrief(event);
    case "generateAlertDraft":
      return generateAlertDraft(event);
    case "recommendOperations":
      return recommendOperations(event);
    case "triageSosCase":
      return triageSosCase(event);
    case "recommendResourceDispatch":
      return recommendResourceDispatch(event);
    default:
      throw new Error(`Unknown AI field: ${event.info.fieldName}`);
  }
}
