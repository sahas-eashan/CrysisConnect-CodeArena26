import assert from "node:assert/strict";
import test from "node:test";
import { createHazardService } from "../src/lib/hazards/service";
import { initialState, type HazardStore } from "../src/lib/hazards/store";
import type { RouteProvider } from "../src/lib/hazards/routing";
import type { HazardCase, HazardState } from "../src/lib/hazards/types";

const initialTime = Date.parse("2026-09-12T12:00:00Z");
const location = { latitude: 6.952, longitude: 79.88 };
const residentLocation = { latitude: 6.957, longitude: 79.88 };
const officer = { id: "synthetic-officer", role: "government" as const };

class MemoryStore implements HazardStore {
  readonly mode = "local-demo" as const;
  state = initialState([{ id: "synthetic-shelter", name: "Synthetic shelter", location: { latitude: 6.967, longitude: 79.88 }, available: 200, capacity: 200, fixture: true }]);
  transactions = 0;
  failTransaction = -1;
  async read() { return structuredClone(this.state); }
  async legacyHazards() { return []; }
  async transaction<T>(operation: (state: HazardState) => T): Promise<T> {
    if (++this.transactions === this.failTransaction) throw new Error("TEST delivery storage failure");
    const draft = structuredClone(this.state), result = operation(draft);
    this.state = draft;
    return structuredClone(result);
  }
}

function setup(residents = 1, provider?: RouteProvider) {
  const store = new MemoryStore();
  const at = new Date(initialTime).toISOString();
  const item: HazardCase = { id: "synthetic-report", revision: 1, source: "citizen", kind: "blocked_road", title: "Synthetic obstruction", description: "Synthetic recorded case for dispatch regression", location, radiusM: 150, status: "needs_verification", reportedBy: "synthetic-reporter", createdAt: at, updatedAt: at, checks: [], verdict: { decision: "needs_verification", confidence: null, reason: "Pending officer assessment", origin: "system" }, evidence: [], history: [], helpRequested: false, needs: "" };
  store.state.cases.push(item);
  store.state.residents = Array.from({ length: residents }, (_, index) => ({ id: `resident-${index}`, location: residentLocation, locationUpdatedAt: at, alertsEnabled: true }));
  let currentTime = initialTime;
  const routeProvider: RouteProvider = provider ?? (async (origin, shelter) => [{ coordinates: [[origin.longitude, origin.latitude], [shelter.location.longitude, shelter.location.latitude]], distanceM: 1100, durationSeconds: 180 }]);
  const service = createHazardService({ store, now: () => currentTime, routeProvider });
  return { store, service, setTime: (value: number) => { currentTime = value; } };
}

function pausedProvider(expectedCalls: number) {
  let release!: () => void, started!: () => void;
  const pause = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { started = resolve; });
  let calls = 0, active = 0, maximum = 0;
  const provider: RouteProvider = async (origin, shelter) => {
    calls++; active++; maximum = Math.max(maximum, active);
    if (calls === expectedCalls) started();
    await pause;
    active--;
    return [{ coordinates: [[origin.longitude, origin.latitude], [shelter.location.longitude, shelter.location.latitude]], distanceM: 1100, durationSeconds: 180 }];
  };
  return { provider, ready, release: () => release(), counts: () => ({ calls, active, maximum }) };
}

test("failure preparing delivery records cannot report failure after the officer's confirmation was committed", async () => {
  const { store, service } = setup();
  store.failTransaction = 2; // 1: primary review, 2: optional delivery preparation.
  const reviewed = await service.reviewCase(officer, "synthetic-report", "confirmed", "Synthetic field verification completed.");
  assert.equal(reviewed.status, "confirmed");
  const state = await store.read();
  assert.equal(state.cases[0].status, "confirmed");
  assert.equal(state.alerts.length, 1, "The durable area warning remains visible to later snapshots.");
  assert.equal(state.feedback.length, 1);
  assert.equal((await service.snapshot({ id: "resident-0", role: "citizen" })).alerts[0].route?.status, "available", "A later snapshot recovers route guidance independently of delivery preparation.");
});

test("failure saving an enriched route retains honest deferred guidance without rolling back a confirmed hazard", async () => {
  const { store, service } = setup();
  store.failTransaction = 3; // 1: review, 2: deferred guidance, 3: enriched route write.
  const reviewed = await service.reviewCase(officer, "synthetic-report", "confirmed", "Synthetic field verification completed.");
  assert.equal(reviewed.status, "confirmed");
  const state = await store.read(), delivery = state.deliveries![0];
  assert.equal(delivery.route.status, "unavailable");
  assert.match(delivery.route.reason, /pending/);
  assert.deepEqual(delivery.route.coordinates, []);
  assert.deepEqual(delivery.route.screenedHazardIds, []);
});

test("a large audience gets durable guidance before one capped and fully awaited provider wave", { timeout: 5000 }, async t => {
  const pause = pausedProvider(3), { store, service } = setup(20, pause.provider);
  t.after(pause.release);
  const review = service.reviewCase(officer, "synthetic-report", "confirmed", "Synthetic field verification completed.");
  await pause.ready;
  assert.equal((await store.read()).deliveries!.length, 20);
  assert.ok((await store.read()).deliveries!.every(delivery => delivery.route.status === "unavailable"));
  assert.deepEqual(pause.counts(), { calls: 3, active: 3, maximum: 3 });
  pause.release();
  assert.equal((await review).status, "confirmed");
  assert.deepEqual(pause.counts(), { calls: 3, active: 0, maximum: 3 }, "No provider promise remains running after the mutation returns.");
  const deliveries = (await store.read()).deliveries!;
  assert.equal(deliveries.filter(delivery => delivery.route.status === "available").length, 3);
  assert.equal(deliveries.filter(delivery => delivery.route.status === "unavailable").length, 17);
  assert.equal((await service.snapshot({ id: "resident-19", role: "citizen" })).alerts[0].route?.status, "available", "A deferred resident receives fresh automatic guidance on opening the app.");
});

test("forgetting location during route planning never resurrects the recipient or their stored route", { timeout: 5000 }, async t => {
  const pause = pausedProvider(1), { store, service } = setup(1, pause.provider);
  t.after(pause.release);
  const review = service.reviewCase(officer, "synthetic-report", "confirmed", "Synthetic field verification completed.");
  await pause.ready;
  await service.forgetLocation({ id: "resident-0", role: "citizen" });
  pause.release();
  await review;
  const state = await store.read();
  assert.deepEqual(state.residents, []);
  assert.deepEqual(state.deliveries, []);
});

test("a location expiring during planning loses its deferred delivery and cannot receive the completed route", { timeout: 5000 }, async t => {
  const pause = pausedProvider(1), { store, service, setTime } = setup(1, pause.provider);
  store.state.residents![0].locationUpdatedAt = new Date(initialTime - 24 * 60 * 60_000 + 1000).toISOString();
  t.after(pause.release);
  const review = service.reviewCase(officer, "synthetic-report", "confirmed", "Synthetic field verification completed.");
  await pause.ready;
  setTime(initialTime + 2000);
  pause.release();
  await review;
  assert.deepEqual((await store.read()).deliveries, []);
});

test("concurrent hazard changes discard enriched delivery geometry instead of storing a route from the earlier context", { timeout: 5000 }, async t => {
  const pause = pausedProvider(1), { store, service } = setup(1, pause.provider);
  t.after(pause.release);
  const review = service.reviewCase(officer, "synthetic-report", "confirmed", "Synthetic field verification completed.");
  await pause.ready;
  await store.transaction(state => { state.cases.push({ ...structuredClone(state.cases[0]), id: "new-obstruction", location: { latitude: 6.962, longitude: 79.88 } }); });
  pause.release();
  await review;
  const route = (await store.read()).deliveries![0].route;
  assert.equal(route.status, "unavailable");
  assert.deepEqual(route.coordinates, []);
});
