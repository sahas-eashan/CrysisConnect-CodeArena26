import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { createAutomaticRelief } from "../src/lib/hazards/auto-relief";
import { distanceM } from "../src/lib/hazards/engine";
import type { RouteCandidate, RouteProvider } from "../src/lib/hazards/routing";
import { initialState, LocalHazardStore } from "../src/lib/hazards/store";
import type { HazardActor, HazardCase, HazardState, Shelter } from "../src/lib/hazards/types";
import { HazardError } from "../src/lib/hazards/validation";

const now = () => Date.parse("2026-09-12T12:00:00Z");
const actor: HazardActor = { id: "test-relief-coordinator", role: "relief" };
const origin = { latitude: 6.9, longitude: 79.8 };
const near: Shelter = { id: "near", name: "TEST nearest shelter", location: { latitude: 6.9, longitude: 79.82 }, capacity: 10, available: 10, fixture: true };
const far: Shelter = { id: "far", name: "TEST farther shelter", location: { latitude: 6.94, longitude: 79.8 }, capacity: 10, available: 10, fixture: true };
const input = { organization: "TEST relief", resources: "Beds and drinking water", people: 3 };
const status = (expected: number) => (error: unknown) => error instanceof HazardError && error.status === expected;
const polygon = (west: number, south: number, east: number, north: number) => ({ type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] });
const route: RouteProvider = async (point, shelter) => [{ coordinates: [[point.longitude, point.latitude], [shelter.location.longitude, shelter.location.latitude]], distanceM: distanceM(point, shelter.location), durationSeconds: shelter.id === "far" ? 1 : 100 }];
const exclusions = (state: HazardState) => state.cases.filter(item => item.status === "confirmed" || item.status === "assigned").map(item => ({ id: item.id, location: item.location, radiusM: item.radiusM }));

function item(id = "help-request"): HazardCase {
  const at = new Date(now()).toISOString();
  return { id, revision: 1, source: "citizen", kind: "blocked_road", title: "TEST assistance request", description: "TEST household requests shelter and food.", location: origin, radiusM: 120, status: "needs_verification", reportedBy: `reporter-${id}`, createdAt: at, updatedAt: at, checks: [], verdict: { decision: "needs_verification", confidence: null, reason: "TEST pending human review", origin: "system" }, evidence: [], history: [], helpRequested: true, needs: "Shelter places" };
}

async function setup(t: TestContext, shelters: Shelter[] = [far, near], cases: HazardCase[] = [item()]) {
  const directory = await mkdtemp(join(tmpdir(), "automatic-relief-test-"));
  t.after(async () => {
    const absolute = resolve(directory);
    assert.equal(dirname(absolute), resolve(tmpdir()));
    assert.ok(basename(absolute).startsWith("automatic-relief-test-"));
    await rm(absolute, { recursive: true, force: true });
  });
  const seed = initialState(shelters);
  seed.cases = structuredClone(cases);
  const store = new LocalHazardStore(join(directory, "state.json"), seed);
  store.legacyHazards = async () => [];
  const automatic = (routeProvider: RouteProvider = route, assertCaseAccess: (actor: HazardActor, item: HazardCase) => void = () => undefined) => createAutomaticRelief({ store, now, routeProvider, exclusions, assertCaseAccess });
  return { store, automatic };
}

test("automatic relief chooses nearest routable capacity rather than array order or a distant route's faster duration", async t => {
  const { store, automatic } = await setup(t);
  const result = await automatic().autoRelief(actor, "help-request", input);
  assert.equal(result.relief?.shelterId, "near");
  assert.equal(result.relief?.route?.status, "available");
  assert.equal(result.relief?.route?.durationSeconds, 100);
  assert.equal(result.relief?.route?.shelter?.available, 7);
  assert.equal((await store.read()).shelters.find(shelter => shelter.id === "far")!.available, 10);
  assert.equal(result.history.at(-1)?.action, "relief_auto_allocated");
});

test("automatic relief skips insufficient capacity and credits an existing same-case reservation on reassignment", async t => {
  const { store, automatic } = await setup(t, [{ ...near, available: 1 }, far]);
  const result = await automatic().autoRelief(actor, "help-request", input);
  assert.equal(result.relief?.shelterId, "far");
  const reassigned = await automatic().autoRelief(actor, "help-request", { ...input, people: 9 });
  assert.equal(reassigned.relief?.shelterId, "far", "Seven currently free places plus this case's three prior places permit nine.");
  assert.equal((await store.read()).shelters.find(shelter => shelter.id === "far")!.available, 1);
  await assert.rejects(automatic().autoRelief(actor, "help-request", { ...input, people: 11 }), status(409));
  assert.equal((await store.read()).shelters.find(shelter => shelter.id === "far")!.available, 1, "A failed resize preserves the previous reservation.");
});

test("concurrent households cannot overbook the same capacity and a screened alternative is selected under the lock", async t => {
  const { store, automatic } = await setup(t, [{ ...near, capacity: 4, available: 4 }, { ...far, capacity: 4, available: 4 }], [item("first"), item("second"), item("third")]);
  const service = automatic();
  const results = await Promise.allSettled(["first", "second", "third"].map(id => service.autoRelief(actor, id, { ...input, people: 4 })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 2);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(status(409)(rejected.reason));
  const state = await store.read();
  assert.deepEqual(state.shelters.map(shelter => shelter.available), [0, 0]);
  assert.equal(state.cases.reduce((sum, entry) => sum + (entry.relief?.people ?? 0), 0), 8);
  assert.deepEqual(new Set(state.cases.flatMap(entry => entry.relief?.shelterId ?? [])), new Set(["near", "far"]));
});

test("whole road segments crossing legacy polygons are excluded even when both endpoints lie outside", async t => {
  const { store, automatic } = await setup(t);
  store.legacyHazards = async () => [{ id: "road-crossing", geometry: polygon(79.809, 6.899, 79.811, 6.901) }];
  const result = await automatic().autoRelief(actor, "help-request", input);
  assert.equal(result.relief?.shelterId, "far");
  assert.ok(result.relief?.route?.screenedHazardIds.includes("legacy:road-crossing"));
  assert.equal((await store.read()).shelters.find(shelter => shelter.id === "near")!.available, 10);
});

test("the approach between report GPS and a snapped road start is screened before a reservation", async t => {
  const { store, automatic } = await setup(t, [near]);
  store.legacyHazards = async () => [{ id: "approach", geometry: polygon(79.80035, 6.8999, 79.80045, 6.9001) }];
  const snapped: RouteProvider = async () => [{ coordinates: [[79.8008, 6.9], [79.82, 6.9]], distanceM: 2000, durationSeconds: 100 }];
  await assert.rejects(automatic(snapped).autoRelief(actor, "help-request", input), status(409));
  assert.equal((await store.read()).shelters[0].available, 10);
  assert.equal((await store.read()).cases[0].relief, undefined);
});

test("inside a confirmed hazard the nearest safe shelter can be reserved only with an explicit extraction warning and no route", async t => {
  const request = item();
  request.status = "confirmed";
  const unsafe = { ...near, id: "unsafe", location: { latitude: 6.9, longitude: 79.8001 } };
  const { store, automatic } = await setup(t, [unsafe, far, near], [request]);
  let calls = 0;
  const result = await automatic(async () => { calls += 1; throw new Error("No ordinary route may establish an exit."); }).autoRelief(actor, request.id, input);
  assert.equal(calls, 0);
  assert.equal(result.relief?.shelterId, "near");
  assert.equal(result.relief?.route?.status, "unavailable");
  assert.match(result.relief!.route!.reason, /requires crew-assisted extraction/);
  assert.deepEqual(result.relief?.route?.coordinates, []);
  assert.equal(result.relief?.route?.durationSeconds, undefined);
  assert.equal((await store.read()).shelters.find(shelter => shelter.id === "unsafe")!.available, 10);
});

test("missing legacy geometry or a provider failure leaves capacity and case assignment unchanged", async t => {
  const { store, automatic } = await setup(t, [near]);
  store.legacyHazards = async () => [{ id: "missing-boundary", geometry: null }];
  await assert.rejects(automatic().autoRelief(actor, "help-request", input), status(503));
  store.legacyHazards = async () => [];
  await assert.rejects(automatic(async () => { throw new Error("TEST provider unavailable"); }).autoRelief(actor, "help-request", input), status(409));
  assert.equal((await store.read()).shelters[0].available, 10);
  assert.equal((await store.read()).cases[0].relief, undefined);
});

test("newly recorded hazards and changed legacy boundaries are re-screened after provider work", async t => {
  const { store, automatic } = await setup(t, [near]);
  const changesState: RouteProvider = async (point, shelter) => {
    await store.transaction(state => {
      const hazard = item("new-hazard");
      hazard.status = "confirmed";
      hazard.location = { latitude: 6.9, longitude: 79.81 };
      state.cases.push(hazard);
    });
    return route(point, shelter);
  };
  await assert.rejects(automatic(changesState).autoRelief(actor, "help-request", input), status(409));
  await store.transaction(state => { state.cases = state.cases.filter(entry => entry.id !== "new-hazard"); });
  let legacyReads = 0;
  store.legacyHazards = async () => ++legacyReads === 1 ? [] : [{ id: "new-legacy", geometry: polygon(79.809, 6.899, 79.811, 6.901) }];
  await assert.rejects(automatic().autoRelief(actor, "help-request", input), status(409));
  assert.equal(legacyReads, 2);
  assert.equal((await store.read()).shelters[0].available, 10);
});

test("authorization, council access, assistance state and malformed coordinates are checked before allocation", async t => {
  const { store, automatic } = await setup(t, [near]);
  await assert.rejects(automatic().autoRelief({ id: "citizen", role: "citizen" }, "help-request", input), status(403));
  await assert.rejects(automatic().autoRelief({ id: "ngo", role: "ngo" }, "help-request", input), status(403));
  await assert.rejects(automatic(route, () => { throw new HazardError("Different council", 403); }).autoRelief(actor, "help-request", input), status(403));
  await assert.rejects(automatic().autoRelief(actor, "help-request", { ...input, people: 0 }), status(400));
  await assert.rejects(automatic(async () => [{ coordinates: [[79.8, 6.9], [NaN, 6.9]], distanceM: 1, durationSeconds: 1 } as RouteCandidate]).autoRelief(actor, "help-request", input), status(409));
  await store.transaction(state => { state.cases[0].helpRequested = false; });
  await assert.rejects(automatic().autoRelief(actor, "help-request", input), status(409));
  assert.equal((await store.read()).shelters[0].available, 10);
});

test("automatic reassignment cannot discard a reservation whose original shelter is missing", async t => {
  const previous = item();
  previous.relief = { organization: "TEST prior relief", resources: "Three existing places", shelterId: "missing-prior-shelter", people: 3, assignedBy: actor.id, assignedAt: new Date(now()).toISOString() };
  const { store, automatic } = await setup(t, [near], [previous]);
  await assert.rejects(automatic().autoRelief(actor, previous.id, input), error => status(409)(error) && (error as HazardError).code === "SHELTER_MISSING");
  const state = await store.read();
  assert.equal(state.shelters[0].available, 10);
  assert.equal(state.cases[0].relief?.shelterId, "missing-prior-shelter");
  assert.equal(state.cases[0].relief?.people, 3);
});
