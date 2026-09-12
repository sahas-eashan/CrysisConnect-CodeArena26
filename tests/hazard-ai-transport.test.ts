import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHazard, type EvaluationContext, type EvaluationResult } from "../src/lib/hazards/ai";
import { initialState } from "../src/lib/hazards/store";
import type { HazardCase, HazardCheck } from "../src/lib/hazards/types";
import { resolveGeography } from "../src/lib/hazards/geography";

// This suite exercises the real Gemini adapter with an intercepted HTTP transport.
// It never delegates evaluation to a fake domain evaluator or contacts a live provider.
const TEST_KEY = "TEST_ONLY_HAZARD_TRANSPORT_KEY";
const TEST_MODEL = "transport-fixture-model";
const imageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==";
type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type CapturedRequest = {
  url: URL;
  method: string | undefined;
  headers: Headers;
  signal: AbortSignal | null | undefined;
  body: {
    systemInstruction: { parts: Part[] };
    contents: { role: string; parts: Part[] }[];
    generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
  };
  prompt: string;
};

function context(): EvaluationContext {
  const now = Date.parse("2026-09-12T07:00:00.000Z");
  const at = new Date(now).toISOString();
  const item: HazardCase = {
    id: "test-report", revision: 1, source: "citizen", kind: "flood", title: "TEST photograph of a flooded street",
    description: "TEST fixture: a person requests shelter after water covered the road.", location: { latitude: 6.9, longitude: 79.8 },
    radiusM: 500, status: "needs_verification", reportedBy: "test-citizen", createdAt: at, updatedAt: at,
    checks: [], verdict: { decision: "needs_verification", confidence: null, reason: "TEST evaluation pending", origin: "system" },
    evidence: [{ id: "test-photo", kind: "report", dataUrl: `data:image/png;base64,${imageBase64}`, mimeType: "image/png", uploadedAt: at, uploadedBy: "test-citizen", notes: "Synthetic test image" }],
    history: [], helpRequested: true, needs: "TEST: two shelter beds",
  };
  const state = initialState();
  state.cases.push(item);
  state.weather.push({ id: "test-weather", stationId: "TEST-STATION", location: item.location, rainfallMm: 80, waterLevelM: 5, dangerLevelM: 4, observedAt: at, receivedAt: at, source: "operator" });
  return { item, state, now };
}

function kind(request: CapturedRequest): "image" | "location" | "risk" | "aggregator" {
  if (request.prompt.startsWith("Inspect the attached photograph")) return "image";
  if (request.prompt.startsWith("Assess whether the supplied location")) return "location";
  if (request.prompt.startsWith("Assess immediate hazard risk")) return "risk";
  if (request.prompt.startsWith("Aggregate ALL")) return "aggregator";
  throw new Error("Unexpected test transport request.");
}

function providerResponse(value: unknown): Response {
  return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [
    { thought: true, text: "TEST thought content is not part of the JSON response." },
    { text: JSON.stringify(value) },
  ] } }] });
}

function validResponse(request: CapturedRequest, aggregatorConfidence = 0.93): Response {
  const operation = kind(request);
  if (operation === "aggregator") return providerResponse({ decision: "confirmed", confidence: aggregatorConfidence, reason: "TEST aggregate: photograph, weather and risk evidence support the claimed flood. Urgent assistance is requested.", urgency: "high" });
  return providerResponse({
    status: operation === "location" ? "inconclusive" : "supports",
    confidence: operation === "image" ? 0.94 : operation === "risk" ? 0.92 : 0.35,
    reason: operation === "location" ? "TEST location: supplied coordinates do not independently verify the photograph's location." : `TEST ${operation}: supplied observations support the claimed flood.`,
    evidence: operation === "image" ? ["TEST photo: visible water"] : ["test-weather"],
  });
}

async function interceptedEvaluate(responder: (request: CapturedRequest) => Response, input = context()): Promise<{ result: EvaluationResult; requests: CapturedRequest[] }> {
  const names = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "HAZARD_GEMINI_MODEL"] as const;
  const environment = new Map(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  const requests: CapturedRequest[] = [];
  Object.assign(process.env, { GEMINI_API_KEY: TEST_KEY, HAZARD_GEMINI_MODEL: TEST_MODEL });
  delete process.env.GOOGLE_API_KEY;
  globalThis.fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body)) as CapturedRequest["body"];
    const request: CapturedRequest = {
      url: new URL(input instanceof Request ? input.url : String(input)), method: init?.method,
      headers: new Headers(init?.headers), signal: init?.signal, body,
      prompt: body.contents[0].parts.map(part => part.text || "").join(""),
    };
    requests.push(request);
    return responder(request);
  };
  try { return { result: await evaluateHazard(input), requests }; }
  finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of environment) {
      if (value === undefined) delete process.env[name];
      else Object.assign(process.env, { [name]: value });
    }
  }
}

function aggregatedChecks(requests: CapturedRequest[]): HazardCheck[] {
  const aggregator = requests.find(request => kind(request) === "aggregator");
  assert.ok(aggregator, "The real adapter must call the aggregator.");
  return JSON.parse(aggregator.prompt.split("\nALL_CHECKS_JSON:\n")[1]) as HazardCheck[];
}

test("Gemini transport sends image and location pixels, factual risk context, and all five checks to aggregation", async () => {
  const { result, requests } = await interceptedEvaluate(request => validResponse(request));
  assert.equal(requests.length, 4);
  for (const request of requests) {
    assert.equal(request.method, "POST");
    assert.equal(request.url.origin, "https://generativelanguage.googleapis.com");
    assert.equal(request.url.pathname, `/v1beta/models/${TEST_MODEL}:generateContent`);
    assert.equal(request.url.search, "", "The API key must not enter request URLs.");
    assert.equal(request.headers.get("x-goog-api-key"), TEST_KEY);
    assert.equal(request.headers.get("content-type"), "application/json");
    assert.equal(request.url.toString().includes(TEST_KEY), false);
    assert.equal(request.body.generationConfig.responseMimeType, "application/json");
    assert.ok(request.body.generationConfig.responseSchema.required.includes("confidence"));
    assert.ok(request.signal, "Provider requests must have a bounded lifetime.");
    assert.match(request.body.systemInstruction.parts[0].text!, /UNTRUSTED EVIDENCE/);
  }
  for (const operation of ["image", "location", "aggregator"] as const) {
    const request = requests.find(entry => kind(entry) === operation)!;
    assert.deepEqual(request.body.contents[0].parts.find(part => part.inlineData)?.inlineData, { mimeType: "image/png", data: imageBase64 });
  }
  const location = requests.find(request => kind(request) === "location")!;
  assert.match(location.prompt, /contextual plausibility from verification/);
  const risk = requests.find(request => kind(request) === "risk")!;
  assert.equal(risk.body.contents[0].parts.some(part => part.inlineData), false);
  const riskFacts = JSON.parse(risk.prompt.split("\nEVIDENCE_JSON:\n")[1]);
  assert.equal(riskFacts.report.id, "test-report");
  assert.deepEqual(riskFacts.report.location, { latitude: 6.9, longitude: 79.8 });
  assert.equal(riskFacts.report.helpRequested, true);
  assert.equal(riskFacts.weather[0].id, "test-weather");
  assert.equal(riskFacts.weather[0].rainfallMm, 80);
  assert.match(riskFacts.geographicReferenceData, /No authoritative ward boundary/);
  const checks = aggregatedChecks(requests);
  assert.deepEqual(checks.map(check => check.id), ["weather", "cluster", "image", "location", "risk"]);
  assert.deepEqual(checks, result.checks, "Aggregation receives the full persisted records, including reasons and evidence.");
  assert.equal(checks.find(check => check.id === "image")!.confidence, 0.94);
  assert.equal(checks.find(check => check.id === "location")!.confidence, 0.35);
  assert.equal(checks.find(check => check.id === "risk")!.confidence, 0.92);
  assert.equal(result.verdict.decision, "confirmed");
  assert.equal(result.verdict.confidence, 0.93);
  assert.equal(result.verdict.origin, "ai");
  assert.equal(result.verdict.model, TEST_MODEL);
  assert.equal(result.verdict.urgency, "high");
  assert.ok(requests.find(request => kind(request) === "aggregator")!.body.generationConfig.responseSchema.required.includes("urgency"));
});

test("location and aggregation receive the supplied geography and server EXIF conflict, which prevents automatic confirmation", async () => {
  const input = context();
  input.item.location = { latitude: 6.952, longitude: 79.88 };
  input.item.geography = resolveGeography(input.item.location, { demo: true });
  input.item.evidence[0].metadata = { status: "gps_mismatch", gps: { latitude: 7.2, longitude: 80.1 }, distanceFromReportM: 36_000, camera: "TEST camera", capturedAtRaw: "2026:09:12 10:00:00", reason: "TEST server-extracted GPS conflicts with the report location." };
  const { result, requests } = await interceptedEvaluate(request => validResponse(request, 0.99), input);
  for (const operation of ["location", "aggregator"] as const) {
    const request = requests.find(request => kind(request) === operation)!;
    const facts = JSON.parse(request.prompt.split("\nEVIDENCE_JSON:\n")[1].split("\nALL_CHECKS_JSON:\n")[0]);
    assert.deepEqual(facts.geography, input.item.geography);
    assert.deepEqual(facts.photoMetadata[0].metadata, input.item.evidence[0].metadata);
    assert.ok(request.body.contents[0].parts.some(part => part.inlineData));
  }
  assert.equal(result.checks.find(check => check.id === "location")!.status, "contradicts");
  assert.equal(result.verdict.decision, "needs_verification");
});

test("invalid structured urgency fails aggregation without fabricating a priority", async () => {
  const { result } = await interceptedEvaluate(request => kind(request) === "aggregator"
    ? providerResponse({ decision: "confirmed", confidence: 0.99, reason: "TEST otherwise valid result has a malformed urgency value.", urgency: "urgent!!!" })
    : validResponse(request));
  assert.equal(result.verdict.decision, "needs_verification");
  assert.equal(result.verdict.confidence, null);
  assert.equal(result.verdict.urgency, "unknown");
});

test("a model confirmation below the operational threshold is gated while its supplied confidence is retained", async () => {
  const { result } = await interceptedEvaluate(request => validResponse(request, 0.42));
  assert.equal(result.verdict.decision, "needs_verification");
  assert.equal(result.verdict.confidence, 0.42);
  assert.match(result.verdict.reason, /Human review is required/);
});

test("Gemini HTTP 429 makes the failed check unavailable and prevents a confident aggregator from confirming", async () => {
  const { result, requests } = await interceptedEvaluate(request => kind(request) === "image"
    ? Response.json({ error: { message: "TEST provider rate limit" } }, { status: 429 })
    : validResponse(request, 0.99));
  const image = result.checks.find(check => check.id === "image")!;
  assert.equal(image.status, "unavailable");
  assert.equal(image.confidence, null);
  assert.equal(result.checks.find(check => check.id === "risk")!.confidence, 0.92);
  assert.equal(aggregatedChecks(requests).find(check => check.id === "image")!.status, "unavailable");
  assert.equal(result.verdict.decision, "needs_verification");
  assert.equal(result.verdict.confidence, null);
  assert.equal(result.verdict.origin, "system");
});

test("malformed check confidence cannot become a fabricated usable assessment", async () => {
  const { result, requests } = await interceptedEvaluate(request => kind(request) === "image"
    ? providerResponse({ status: "supports", confidence: "94%", reason: "TEST provider returned a malformed confidence field.", evidence: ["synthetic image"] })
    : validResponse(request, 0.99));
  const image = result.checks.find(check => check.id === "image")!;
  assert.equal(image.status, "unavailable");
  assert.equal(image.confidence, null);
  assert.deepEqual(image.evidence, []);
  assert.equal(aggregatedChecks(requests).find(check => check.id === "image")!.confidence, null);
  assert.equal(result.verdict.decision, "needs_verification");
  assert.equal(result.verdict.confidence, null);
});

test("out-of-range aggregator confidence leaves valid individual checks available for human review", async () => {
  const { result } = await interceptedEvaluate(request => validResponse(request, 1.5));
  assert.equal(result.checks.find(check => check.id === "image")!.confidence, 0.94);
  assert.equal(result.checks.find(check => check.id === "risk")!.status, "supports");
  assert.equal(result.verdict.decision, "needs_verification");
  assert.equal(result.verdict.confidence, null);
  assert.equal(result.verdict.origin, "system");
  assert.match(result.verdict.reason, /aggregation failed/);
});
