/** Read-only readiness checks. Run with: node --import tsx scripts/verify-live-services.mjs --live */
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const arguments_ = new Set(process.argv.slice(2));
if (arguments_.has("--help")) {
  console.log("Usage: node --import tsx scripts/verify-live-services.mjs [--live]\nWithout --live: print configuration availability only; no network requests.\nWith --live: run read-only cloud checks and four Gemini assessment requests using a synthetic image.\nSet LIVE_CHECK_ID_TOKEN for actual Cognito token verification and the read-only AppSync query.");
  process.exit(0);
}
if ([...arguments_].some(argument => argument !== "--live")) {
  console.error("Unknown option. Use --help for usage.");
  process.exit(2);
}

const configured = name => !!process.env[name]?.trim();
const live = arguments_.has("--live");
const results = [];
const check = async (name, requires, probe) => {
  const missing = requires.filter(group => !group.some(configured)).map(group => group.join(" or "));
  if (missing.length) { results.push({ service: name, status: "blocked", missing }); return; }
  if (!live) { results.push({ service: name, status: "configured_not_tested" }); return; }
  try {
    const detail = await probe();
    results.push({ service: name, status: "passed", detail });
  } catch (error) {
    // Provider errors may contain credential-bearing URLs, tokens or private records.
    results.push({ service: name, status: "failed", detail: error instanceof ProbeFailure ? error.message : "The configured service could not be validated. Inspect provider configuration and connectivity; raw errors are intentionally not logged." });
  }
};
class ProbeFailure extends Error {}
const fail = message => { throw new ProbeFailure(message); };
const parseResponse = async response => {
  if (!response.ok) fail(`The service returned HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 1024 * 1024) fail("The service response exceeded the probe's size limit.");
  return JSON.parse(text);
};

await check("Verified geography", [["HAZARD_GEOGRAPHY_JSON", "HAZARD_GEOGRAPHY_FILE"]], async () => {
  const { geographyCatalog } = await import("../src/lib/hazards/geography.ts");
  const catalog = geographyCatalog({ demo: false });
  if (!catalog.wards.length || !catalog.councils.length) fail("The configured geography could not supply verified, non-fixture ward and council records. Check the GeoJSON format, verification flag and file availability.");
  return `The local loader accepted ${catalog.wards.length} ward(s) and ${catalog.councils.length} council(s) from an operator-asserted verified dataset. No network request was made. This does not certify the data's authority or real-world coverage.`;
});

await check("Gemini hazard assessment", [["GEMINI_API_KEY", "GOOGLE_API_KEY"]], async () => {
  const { evaluateHazard } = await import("../src/lib/hazards/ai.ts");
  const now = Date.now(), at = new Date(now).toISOString();
  const image = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==";
  const item = {
    id: "READ_ONLY_SERVICE_PROBE", revision: 1, source: "citizen", kind: "other",
    title: "Synthetic service-validation image", description: "This is a two-pixel-square synthetic image used to test the service connection. It is not a photograph of an actual disaster. The coordinates are illustrative test coordinates, not verified image metadata.",
    location: { latitude: 6.9, longitude: 79.8 }, radiusM: 200, status: "needs_verification", reportedBy: "read-only-probe", createdAt: at, updatedAt: at,
    checks: [], verdict: { decision: "needs_verification", confidence: null, reason: "Synthetic connection probe", origin: "system" },
    evidence: [{ id: "synthetic-pixels", kind: "report", dataUrl: `data:image/png;base64,${image}`, mimeType: "image/png", uploadedAt: at, uploadedBy: "read-only-probe", notes: "Synthetic image, not an incident" }],
    history: [], helpRequested: false, needs: "",
  };
  const state = { version: 1, cases: [item], alerts: [], weather: [], feedback: [], shelters: [], thresholds: { rainMm: 50, clusterCount: 3, autoConfirmConfidence: 0.9, feedbackCount: 0 }, residents: [], deliveries: [], bans: [] };
  const assessment = await evaluateHazard({ item, state, now });
  const checks = ["image", "location", "risk"].map(id => assessment.checks.find(check => check.id === id));
  if (checks.some(check => !check || check.status === "unavailable") || assessment.verdict.origin !== "ai") fail("The real adapter could not obtain all three structured AI checks and an AI aggregation. Check model access, quota and structured-response support.");
  return "The actual adapter completed three structured checks and aggregation using synthetic pixels. No report was stored. This verifies transport and schema handling, not assessment accuracy.";
});

const cognitoRequires = [["NEXT_PUBLIC_AWS_REGION"], ["NEXT_PUBLIC_COGNITO_USER_POOL_ID"], ["NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID"]];
await check("Cognito signing keys", cognitoRequires, async () => {
  const region = process.env.NEXT_PUBLIC_AWS_REGION, pool = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  if (!/^[a-z0-9-]+$/.test(region) || !/^[a-zA-Z0-9_-]+$/.test(pool)) fail("The Cognito region or user-pool identifier is malformed.");
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${pool}`;
  const keys = await parseResponse(await fetch(`${issuer}/.well-known/jwks.json`, { signal: AbortSignal.timeout(10_000), redirect: "error" }));
  if (!Array.isArray(keys.keys) || !keys.keys.some(key => key.kty === "RSA" && key.alg === "RS256" && key.kid && key.n && key.e)) fail("Cognito did not expose usable RS256 signing keys.");
  return "The configured user pool exposes usable signing keys. Token verification is reported separately.";
});

await check("Cognito authenticated session", [...cognitoRequires, ["LIVE_CHECK_ID_TOKEN"]], async () => {
  const { verifyUserToken } = await import("../src/lib/server-auth.ts");
  const verified = await verifyUserToken(process.env.LIVE_CHECK_ID_TOKEN);
  if (!verified.actor?.id) fail("The supplied ID token did not produce a verified actor.");
  return `The actual server verifier accepted the ID token, including issuer, audience, signature, token type and expiry. Resolved role: ${verified.actor.role}.`;
});

await check("PostgreSQL hazard storage", [["DATABASE_URL"]], async () => {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, statement_timeout: 8000 });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const schema = await client.query("SELECT to_regclass('hazard_state') IS NOT NULL AS hazard_state, to_regclass('disasters') IS NOT NULL AS disasters, EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis");
    if (!schema.rows[0]?.hazard_state || !schema.rows[0]?.disasters || !schema.rows[0]?.postgis) fail("Database connection succeeded, but hazard_state, disasters or PostGIS is missing. Apply the documented migrations before live operation.");
    const state = await client.query("SELECT payload->>'version' AS version, EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'shelters') AS shelter WHERE shelter->>'fixture' = 'false' AND (shelter->>'available')::integer > 0) AS open_real_shelter FROM hazard_state WHERE id = 1");
    if (state.rows[0]?.version !== "1") fail("The hazard schema exists but its application state has not been initialized with a supported version.");
    if (!state.rows[0]?.open_real_shelter) fail("The stored hazard state has no non-fixture shelter with available capacity. Provision verified shelters before live routing.");
    const boundaries = await client.query("SELECT EXISTS(SELECT 1 FROM disasters WHERE status IS DISTINCT FROM 'resolved' AND (affected_area IS NULL OR NOT ST_IsValid(affected_area::geometry))) AS incomplete");
    if (boundaries.rows[0]?.incomplete) fail("An active disaster has an incomplete boundary, so live route screening will fail closed until it is repaired.");
    return "Read-only queries verified the schema, PostGIS, initialized state, available real shelter and usable active disaster boundaries. No records were changed.";
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});

await check("OSRM route provider", [["OSRM_BASE_URL"]], async () => {
  const { fetchOsrmCandidates } = await import("../src/lib/hazards/routing.ts");
  const candidates = await fetchOsrmCandidates({ latitude: 6.9, longitude: 79.86 }, {
    id: "read-only-probe", name: "Synthetic route endpoint", location: { latitude: 6.905, longitude: 79.865 }, capacity: 0, available: 0, fixture: true,
  });
  if (!candidates.length) fail("The OSRM provider returned no usable road route for the Colombo sample. Verify deployment coverage and routing configuration.");
  return "The actual routing adapter received valid road geometry for synthetic Colombo endpoints. This is a connectivity check, not a screened evacuation route.";
});

await check("AppSync authorized read", [["NEXT_PUBLIC_APPSYNC_GRAPHQL_URL"], ["LIVE_CHECK_ID_TOKEN"]], async () => {
  const endpoint = new URL(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) fail("AppSync requires a credential-free HTTPS endpoint URL.");
  const result = await parseResponse(await fetch(endpoint, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json", authorization: process.env.LIVE_CHECK_ID_TOKEN },
    body: JSON.stringify({ query: "query ReadOnlyConnectionProbe { __typename }" }),
  }));
  if (result.errors?.length || result.data?.__typename !== "Query") fail("The configured AppSync API did not authorize the read-only schema query.");
  return "AppSync accepted the supplied ID token for a read-only Query typename request. Business resolvers and outbound notifications were not invoked.";
});

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(), mode: live ? "live_read_only" : "configuration_only",
  status: results.every(result => result.status === "passed") ? "passed" : live ? "incomplete" : "not_validated",
  checks: results,
  limits: "These probes do not deploy infrastructure, send emergency messages, modify application records, verify model accuracy, or validate real-world road/shelter safety. Full operator acceptance remains a separate test in an isolated staging environment.",
}, null, 2));
if (live && results.some(result => result.status !== "passed")) process.exitCode = 2;
