import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { evaluateHazard, type EvaluationContext, type EvaluationResult, type HazardEvaluator } from "../src/lib/hazards/ai";
import { systemChecks, unavailableCheck, updateThresholds } from "../src/lib/hazards/engine";
import { routeIntersectsHazard, selectScreenedRoute, type RouteProvider } from "../src/lib/hazards/routing";
import { createHazardService, HazardError } from "../src/lib/hazards/service";
import { createHazardStore, initialState, LocalHazardStore } from "../src/lib/hazards/store";
import type { HazardActor, HazardReportInput, Shelter, WeatherInput } from "../src/lib/hazards/types";
import { validatePhoto } from "../src/lib/hazards/validation";

// Tiny static image fixtures. These are synthetic test evidence, never demo AI assessments.
const photo = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==" };
const otherPhoto = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVR4nGNgaGAAIQgFAA4OAgFhGn2EAAAAAElFTkSuQmCC" };
const citizen: HazardActor = { id: "test-citizen-1", role: "citizen" };
const government: HazardActor = { id: "test-reviewer", role: "government" };
const ngo: HazardActor = { id: "test-crew", role: "ngo", name: "Test Crew" };
const point = { latitude: 6.9, longitude: 79.8 };
const destination: Shelter = { id: "test-shelter", name: "TEST fixture shelter", location: { latitude: 6.9, longitude: 79.84 }, capacity: 10, available: 10, fixture: true };
const report = (overrides: Partial<HazardReportInput> = {}): HazardReportInput => ({ title: "Test flooded street", description: "Test fixture: water is covering the road in this location.", kind: "flood", location: point, photo, ...overrides });
const reading = (overrides: Partial<WeatherInput> = {}): WeatherInput => ({ stationId: "TEST-STATION", location: point, rainfallMm: 80, waterLevelM: 5, dangerLevelM: 4, observedAt: new Date().toISOString(), ...overrides });
const unavailable: HazardEvaluator = async context => ({ checks: [...systemChecks(context.item, context.state, context.now), ...(["image", "location", "risk"] as const).map(id => unavailableCheck(id, "TEST fixture: AI provider unavailable."))], verdict: { decision: "needs_verification", confidence: null, reason: "TEST fixture: AI did not run.", origin: "system" } });
const supportive = (context: EvaluationContext): EvaluationResult => ({
  checks: [...systemChecks(context.item, context.state, context.now), ...(["image", "location", "risk"] as const).map(id => ({ id, engine: "AI" as const, status: "supports" as const, confidence: 0.98, reason: "TEST ONLY: deterministic injected provider assessment.", evidence: ["synthetic test fixture"] }))],
  verdict: { decision: "confirmed", confidence: 0.97, reason: "TEST ONLY: all injected checks support confirmation.", origin: "ai", model: "test-fixture-model" },
});

async function setup(t: TestContext, evaluate: HazardEvaluator = unavailable) {
  const directory = await mkdtemp(join(tmpdir(), "crysis-hazard-test-"));
  t.after(async () => {
    const absolute = resolve(directory);
    assert.equal(dirname(absolute), resolve(tmpdir()));
    assert.ok(basename(absolute).startsWith("crysis-hazard-test-"));
    await rm(absolute, { recursive: true, force: true });
  });
  const file = join(directory, "state.json");
  const store = new LocalHazardStore(file, initialState([destination]));
  return { store, file, service: createHazardService({ store, evaluate }) };
}

const status = (code: number) => (error: unknown) => error instanceof HazardError && error.status === code;

test("a photo/GPS report persists before unavailable AI and survives a fresh store instance", async t => {
  const { service, file } = await setup(t);
  const item = await service.submitReport(citizen, report());
  assert.equal(item.status, "needs_verification");
  assert.equal(item.verdict.confidence, null);
  assert.deepEqual(item.checks.map(check => check.id), ["weather", "cluster", "image", "location", "risk"]);
  assert.equal(item.checks.filter(check => check.engine === "AI").every(check => check.status === "unavailable" && check.confidence === null), true);
  const reopened = new LocalHazardStore(file);
  assert.equal((await reopened.read()).cases[0].evidence[0].dataUrl, photo.dataUrl);
  const own = await service.snapshot(citizen);
  assert.equal(own.cases.length, 1);
  assert.equal(own.hazards.length, 0);
  assert.equal((await service.snapshot({ id: "other-citizen", role: "citizen" })).cases.length, 0);
});

test("real AI adapter without a server key produces unavailable checks and no fabricated confidence", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report());
  const savedKey = process.env.GEMINI_API_KEY, savedGoogle = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  try {
    const result = await evaluateHazard({ item, state: await store.read(), now: Date.now() });
    assert.equal(result.verdict.decision, "needs_verification");
    assert.equal(result.verdict.confidence, null);
    assert.equal(result.checks.filter(check => check.engine === "AI").every(check => check.status === "unavailable"), true);
  } finally {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedKey;
    if (savedGoogle === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = savedGoogle;
  }
});

test("human evidence loop, crew clearance and explicit shelter release persist a complete history", async t => {
  const { service, store } = await setup(t);
  let item = await service.submitReport(citizen, report({ helpRequested: true, needs: "TEST: shelter for four people" }));
  item = await service.requestEvidence(government, item.id, "Please add a clearer photo showing the road.");
  assert.match(item.informationRequest!.notes, /clearer/);
  item = await service.addEvidence(citizen, item.id, otherPhoto, "Additional view of the affected street.");
  assert.equal(item.informationRequest, undefined);
  item = await service.reviewCase(government, item.id, "confirmed", "Field responders verified the water on the road.");
  assert.equal(item.verdict.origin, "human");
  assert.equal(item.verdict.confidence, null);
  assert.equal((await service.snapshot(citizen)).hazards.length, 1);
  assert.equal((await service.snapshot({ id: "away", role: "citizen" })).alerts.length, 0);
  assert.equal((await service.snapshot({ id: "nearby", role: "citizen" }, point)).alerts.length, 1);
  const queue = (await service.snapshot(ngo)).cases[0];
  assert.equal(queue.evidence.length, 0);
  assert.equal(queue.reportedBy, "redacted");
  assert.equal(queue.assignedCrew, undefined);
  item = await service.assignCase(government, item.id, { id: ngo.id, name: "Test Response Crew" });
  assert.equal((await service.snapshot(ngo)).cases[0].evidence.length, 2);
  item = await service.assignRelief(ngo, item.id, { organization: "Test Relief", resources: "Four beds and drinking water", shelterId: destination.id, people: 4 });
  assert.equal((await store.read()).shelters[0].available, 6);
  // Reallocating a reservation restores the prior quantity in the same transaction.
  await service.assignRelief(government, item.id, { organization: "Test Relief", resources: "Two beds after two people departed", shelterId: destination.id, people: 2 });
  assert.equal((await store.read()).shelters[0].available, 8);
  await assert.rejects(service.assignRelief(government, item.id, { organization: "Test Relief", resources: "Too many beds requested", shelterId: destination.id, people: 11 }), status(409));
  assert.equal((await store.read()).shelters[0].available, 8);
  await assert.rejects(service.closeCase(ngo, item.id, photo, "Existing image is not fresh clearance evidence."), status(400));
  // A third valid PNG fixture for clearance, generated as a solid blue 2x2 image.
  const closure = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVR4nGNgYPgPRmAKABf2A/1+6zfzAAAAAElFTkSuQmCC" };
  item = await service.closeCase(ngo, item.id, closure, "Road cleared and inspected by the assigned crew.");
  assert.equal(item.status, "resolved");
  assert.equal(item.evidence.at(-1)!.kind, "closure");
  assert.equal((await service.snapshot(citizen)).hazards.length, 0);
  assert.equal((await service.snapshot(citizen)).alerts[0].kind, "hazard_resolved");
  assert.equal((await store.read()).shelters[0].available, 8, "Clearance does not assume evacuees left the shelter.");
  item = await service.releaseRelief(ngo, item.id, "Both occupants departed; the beds are available.");
  assert.equal((await store.read()).shelters[0].available, 10);
  assert.ok(item.history.some(entry => entry.action === "evidence_requested"));
  assert.ok(item.history.some(entry => entry.action === "human_confirmed"));
  assert.ok(item.history.some(entry => entry.action === "hazard_cleared"));
  assert.equal((await store.read()).feedback.length, 1);
  assert.equal((await store.read()).thresholds.feedbackCount, 1);
});

test("roles, report ownership and state transitions prevent unauthorized response actions", async t => {
  const { service } = await setup(t);
  const item = await service.submitReport(citizen, report());
  await assert.rejects(service.reviewCase(citizen, item.id, "confirmed", "Unprivileged self confirmation"), status(403));
  await assert.rejects(service.submitWeather(citizen, reading()), status(403));
  await assert.rejects(service.assignCase(government, item.id, { id: ngo.id, name: "Test crew" }), status(409));
  await assert.rejects(service.addEvidence({ id: "other-citizen", role: "citizen" }, item.id, otherPhoto, "Cannot edit another report"), status(403));
  await service.reviewCase(government, item.id, "confirmed", "Verified by field responders.");
  await assert.rejects(service.requestEvidence(government, item.id, "Request should not hide a known hazard"), status(409));
  await assert.rejects(service.assignCase(ngo, item.id, { id: "another-crew", name: "Another crew" }), status(403));
  await service.assignCase(ngo, item.id, { id: ngo.id, name: "Test crew" });
  await assert.rejects(service.closeCase({ id: "different-ngo", role: "ngo" }, item.id, otherPhoto, "Unauthorized crew attempted closure"), status(403));
  await service.reviewCase(government, item.id, "rejected", "A government inspection withdrew the earlier notice.");
  const snapshot = await service.snapshot(citizen);
  assert.equal(snapshot.hazards.length, 0);
  assert.match(snapshot.alerts[0].title, /withdrawn/);
});

test("weather raises durable warnings independently of AI, normal readings stay normal, and retries are idempotent", async t => {
  const { service, store } = await setup(t);
  const normal = await service.submitWeather(government, reading({ stationId: "TEST-NORMAL", rainfallMm: 5, waterLevelM: 1 }));
  assert.equal(normal.case, null);
  const input = reading();
  const high = await service.submitWeather(government, input);
  assert.equal(high.case!.status, "needs_verification");
  assert.equal(high.case!.checks.find(check => check.id === "weather")!.status, "supports");
  const duplicate = await service.submitWeather(government, input);
  assert.equal(duplicate.reading.id, high.reading.id);
  const state = await store.read();
  assert.equal(state.weather.length, 2);
  assert.equal(state.cases.length, 1);
  assert.equal(state.alerts.length, 1);
  assert.equal(state.alerts[0].kind, "weather_warning");
  assert.equal((await service.snapshot({ id: "nearby", role: "citizen" }, point)).alerts.length, 1);
  assert.equal((await service.snapshot({ id: "faraway", role: "citizen" }, { latitude: 7.5, longitude: 80.5 })).alerts.length, 0);
  await assert.rejects(service.submitWeather(government, { ...input, rainfallMm: input.rainfallMm + 1 }), status(409));
  const old = await service.submitWeather(government, reading({ stationId: "TEST-STALE", observedAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() }));
  assert.equal(old.case, null, "Stale dangerous readings cannot create current weather warnings.");
});

test("clustering counts distinct reporters within 200 metres and excludes repeated-account corroboration", async t => {
  const { service } = await setup(t);
  await service.submitReport(citizen, report());
  await service.submitReport(citizen, report());
  const two = await service.submitReport({ id: "test-citizen-2", role: "citizen" }, report());
  assert.equal(two.checks.find(check => check.id === "cluster")!.status, "inconclusive");
  const three = await service.submitReport({ id: "test-citizen-3", role: "citizen" }, report());
  assert.equal(three.checks.find(check => check.id === "cluster")!.status, "supports");
  const remote = await service.submitReport({ id: "test-citizen-4", role: "citizen" }, report({ location: { latitude: 6.91, longitude: 79.8 } }));
  assert.equal(remote.checks.find(check => check.id === "cluster")!.status, "inconclusive");
});

test("AI auto-confirmation requires real SYSTEM support and available checks", async t => {
  const { service } = await setup(t, async context => supportive(context));
  const withoutCorroboration = await service.submitReport(citizen, report());
  assert.equal(withoutCorroboration.status, "needs_verification");
  await service.submitWeather(government, reading());
  const supported = await service.submitReport(citizen, report());
  assert.equal(supported.status, "confirmed");
  assert.equal(supported.verdict.confidence, 0.97);
});

test("a slow AI response cannot overwrite a newer human review", async t => {
  let release!: () => void, signalStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const { store, service } = await setup(t, async context => { signalStarted(); await gate; return supportive(context); });
  const submission = service.submitReport(citizen, report());
  await started;
  const saved = (await store.read()).cases[0];
  await service.reviewCase(government, saved.id, "rejected", "A reviewer inspected and rejected the report while AI was running.");
  release();
  const returned = await submission;
  assert.equal(returned.status, "rejected");
  assert.equal(returned.verdict.origin, "human");
  assert.equal(returned.history.at(-1)!.action, "human_rejected");
});

test("weather warnings are persisted while AI is still running", async t => {
  let release!: () => void, signalStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { signalStarted = resolve; });
  const { store, service } = await setup(t, async context => { signalStarted(); await gate; return unavailable(context); });
  const pending = service.submitWeather(government, reading());
  await started;
  const state = await store.read();
  assert.equal(state.weather.length, 1);
  assert.equal(state.cases[0].status, "needs_verification");
  assert.equal(state.alerts[0].kind, "weather_warning");
  release();
  await pending;
});

test("new weather evidence discards a stale AI assessment", async t => {
  let release!: () => void, signalStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { signalStarted = resolve; });
  const { service } = await setup(t, async context => {
    if (context.item.source === "weather") return unavailable(context);
    signalStarted(); await gate; return supportive(context);
  });
  const pending = service.submitReport(citizen, report());
  await started;
  await service.submitWeather(government, reading());
  release();
  const item = await pending;
  assert.equal(item.status, "needs_verification");
  assert.equal(item.verdict.confidence, null);
  assert.equal(item.checks.find(check => check.id === "weather")!.status, "supports");
  assert.ok(item.checks.filter(check => check.engine === "AI").every(check => check.status === "unavailable"));
});

test("feedback tuning stays conservatively bounded and repeated case labels do not multiply training weight", () => {
  const state = initialState();
  for (let index = 0; index < 200; index++) state.feedback.push({ caseId: `test-${index}`, actorId: "reviewer", at: new Date().toISOString(), decision: "confirmed", previousDecision: "needs_verification", notes: "Test label" });
  updateThresholds(state);
  assert.equal(state.thresholds.autoConfirmConfidence, 0.85);
  for (const feedback of state.feedback) { feedback.decision = "rejected"; feedback.previousDecision = "confirmed"; }
  state.feedback.push({ ...state.feedback[0] });
  updateThresholds(state);
  assert.equal(state.thresholds.autoConfirmConfidence, 0.98);
  assert.equal(state.thresholds.feedbackCount, 200);
});

test("local transactions serialize across store instances and roll back mutations on error", async t => {
  const { store, file } = await setup(t);
  const second = new LocalHazardStore(file);
  await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? store : second).transaction(state => { state.thresholds.feedbackCount += 1; })));
  assert.equal((await store.read()).thresholds.feedbackCount, 30);
  await assert.rejects(store.transaction(state => { state.thresholds.feedbackCount = 999; throw new Error("TEST rollback"); }), /rollback/);
  assert.equal((await second.read()).thresholds.feedbackCount, 30);
  await writeFile(file, "{broken JSON", "utf8");
  await assert.rejects(store.transaction(state => { state.cases = []; }), status(503));
  assert.equal(await readFile(file, "utf8"), "{broken JSON");
});

test("photo validation rejects invalid MIME bytes, remote URLs, oversize content and invalid GPS", async t => {
  assert.equal((await validatePhoto(photo)).mimeType, "image/png");
  await assert.rejects(validatePhoto({ dataUrl: photo.dataUrl.replace("image/png", "image/jpeg") }), status(400));
  await assert.rejects(validatePhoto({ dataUrl: "https://example.com/photo.png" }), status(400));
  await assert.rejects(validatePhoto({ dataUrl: `data:image/png;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64")}` }), status(400));
  const { service } = await setup(t);
  await assert.rejects(service.submitReport(citizen, report({ location: { latitude: 91, longitude: 79 } })), status(400));
});

test("a fake PNG header cannot submit a report or clear an assigned hazard", async t => {
  const { service, store } = await setup(t);
  const fake = { dataUrl: `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).toString("base64")}` };
  await assert.rejects(service.submitReport(citizen, report({ photo: fake })), status(400));
  assert.equal((await store.read()).cases.length, 0);
  const item = await service.submitReport(citizen, report());
  await service.reviewCase(government, item.id, "confirmed", "Test responders confirmed this report.");
  await service.assignCase(government, item.id, { id: ngo.id, name: "Test crew" });
  await assert.rejects(service.closeCase(ngo, item.id, fake, "A fake header is not photo evidence."), status(400));
  const saved = (await store.read()).cases[0];
  assert.equal(saved.status, "assigned");
  assert.equal(saved.evidence.length, 1);
  assert.equal(saved.history.at(-1)!.action, "crew_assigned");
});

test("routing screens entire segments and selects a real candidate that goes around the hazard", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report({ kind: "fallen_tree", location: { latitude: 6.9, longitude: 79.82 } }));
  await service.reviewCase(government, item.id, "confirmed", "The road is blocked by a fallen tree.");
  const straight: [number, number][] = [[79.8, 6.9], [79.84, 6.9]];
  const around: [number, number][] = [[79.8, 6.9], [79.8, 6.91], [79.84, 6.91], [79.84, 6.9]];
  assert.equal(routeIntersectsHazard(straight, { id: item.id, location: item.location, radiusM: item.radiusM }), true);
  assert.equal(routeIntersectsHazard(around, { id: item.id, location: item.location, radiusM: item.radiusM }), false);
  const provider: RouteProvider = async () => [{ coordinates: straight, distanceM: 4000, durationSeconds: 300 }, { coordinates: around, distanceM: 6200, durationSeconds: 500 }];
  const routing = createHazardService({ store, evaluate: unavailable, routeProvider: provider });
  const route = await routing.planSafeRoute(citizen, point);
  assert.equal(route.status, "available");
  assert.deepEqual(route.coordinates, around);
  assert.ok(route.screenedHazardIds.includes(item.id));
  assert.match(route.reason, /fixture shelter/);
  const failed = await selectScreenedRoute(point, [destination], [], Date.now(), async () => { throw new Error("TEST provider failure"); });
  assert.equal(failed.status, "unavailable");
  assert.deepEqual(failed.coordinates, []);
});

test("a hazard confirmed during a route request invalidates the returned candidate", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report({ kind: "fallen_tree", location: { latitude: 6.9, longitude: 79.82 } }));
  let release!: () => void, signalStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { signalStarted = resolve; });
  const routing = createHazardService({ store, evaluate: unavailable, routeProvider: async () => { signalStarted(); await gate; return [{ coordinates: [[79.8, 6.9], [79.84, 6.9]], distanceM: 4000, durationSeconds: 300 }]; } });
  const pending = routing.planSafeRoute(citizen, point);
  await started;
  await service.reviewCase(government, item.id, "confirmed", "Confirmed while the routing provider was responding.");
  release();
  const route = await pending;
  assert.equal(route.status, "unavailable");
  assert.deepEqual(route.coordinates, []);
  assert.match(route.reason, /changed while routing/);
});

test("a missing legacy disaster boundary blocks routing", async t => {
  const { store } = await setup(t);
  store.legacyHazards = async () => [{ id: "legacy-flood", geometry: null }];
  const service = createHazardService({ store, evaluate: unavailable, routeProvider: async () => [{ coordinates: [[79.8, 6.9], [79.84, 6.9]], distanceM: 4000, durationSeconds: 300 }] });
  const route = await service.planSafeRoute(citizen, point);
  assert.equal(route.status, "unavailable");
  assert.deepEqual(route.coordinates, []);
  assert.ok(route.screenedHazardIds.includes("legacy:legacy-flood"));
});

test("legacy flooded shelter locations cannot receive relief reservations", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report({ helpRequested: true, needs: "TEST: two shelter beds" }));
  store.legacyHazards = async () => [{ id: "legacy-flood", geometry: { type: "Polygon", coordinates: [[[79.83, 6.89], [79.85, 6.89], [79.85, 6.91], [79.83, 6.91], [79.83, 6.89]]] } }];
  await assert.rejects(service.assignRelief(government, item.id, { organization: "Test Relief", resources: "Two beds", shelterId: destination.id, people: 2 }), status(409));
  assert.equal((await store.read()).shelters[0].available, 10);
});

test("mobile candidate screening uses current hazards without requesting a new OSRM route", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report({ kind: "fallen_tree", location: { latitude: 6.9, longitude: 79.82 } }));
  await service.reviewCase(government, item.id, "confirmed", "Test responders verified the blocked road.");
  const screening = createHazardService({ store, evaluate: unavailable, routeProvider: async () => { throw new Error("A preflight must not contact OSRM."); } });
  assert.equal((await screening.screenRoute(citizen, [[79.8, 6.9], [79.84, 6.9]])).safe, false);
  const around: [number, number][] = [[79.8, 6.9], [79.8, 6.91], [79.84, 6.91], [79.84, 6.9]];
  const result = await screening.screenRoute(citizen, around);
  assert.equal(result.safe, true);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
  await assert.rejects(screening.screenRoute(citizen, [[181, 6.9], [79.8, 6.9]]), status(400));
  store.legacyHazards = async () => [{ id: "unknown", geometry: null }];
  assert.equal((await screening.screenRoute(citizen, around)).safe, false);
});

test("production storage fails closed without a configured database or explicit demo mode", async () => {
  const names = ["NODE_ENV", "DATABASE_URL", "HAZARD_DEMO_MODE", "HAZARD_SHELTERS_JSON"] as const;
  const original = new Map(names.map(name => [name, process.env[name]]));
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.DATABASE_URL; delete process.env.HAZARD_DEMO_MODE; delete process.env.HAZARD_SHELTERS_JSON;
    await assert.rejects(createHazardStore(), status(503));
  } finally { for (const [name, value] of original) { if (value === undefined) delete process.env[name]; else Object.assign(process.env, { [name]: value }); } }
});
