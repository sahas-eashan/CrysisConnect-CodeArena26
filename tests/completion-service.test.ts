import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import type { HazardEvaluator } from "../src/lib/hazards/ai";
import { distanceM, enforceVerdict, systemChecks } from "../src/lib/hazards/engine";
import type { RouteProvider } from "../src/lib/hazards/routing";
import { createHazardService, HazardError } from "../src/lib/hazards/service";
import { initialState, LocalHazardStore } from "../src/lib/hazards/store";
import type { HazardActor, HazardCheck, HazardReportInput, HazardVerdict, Shelter } from "../src/lib/hazards/types";

const photo = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==" };
const clearance = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVR4nGNgYPgPRmAKABf2A/1+6zfzAAAAAElFTkSuQmCC" };
const now = () => Date.parse("2026-09-12T12:00:00Z");
const citizen: HazardActor = { id: "PRIVATE_REPORTER_ID", role: "citizen" };
const government: HazardActor = { id: "cross-council-admin", role: "government" };
const officerA: HazardActor = { id: "officer-a", role: "government", councilIds: ["DEMO-COUNCIL-A"] };
const officerB: HazardActor = { id: "officer-b", role: "government", councilIds: ["DEMO-COUNCIL-B"] };
const relief: HazardActor = { id: "relief-b", role: "relief", councilIds: ["DEMO-COUNCIL-B"] };
const north = { latitude: 6.952, longitude: 79.88 };
const west = { latitude: 6.952, longitude: 79.87 };
const destination: Shelter = { id: "test-northern-shelter", name: "TEST configured shelter", location: { latitude: 6.97, longitude: 79.88 }, capacity: 20, available: 20, fixture: true };
const status = (expected: number) => (error: unknown) => error instanceof HazardError && error.status === expected;
const report = (overrides: Partial<HazardReportInput> = {}): HazardReportInput => ({ title: "PRIVATE_REPORT_TITLE", description: "PRIVATE_REPORT_DESCRIPTION: family contact and observations.", kind: "blocked_road", location: north, photo, helpRequested: true, needs: "PRIVATE_HELP_DETAILS: shelter for three people", ...overrides });
// Controlled evaluator retains structured urgency without claiming an actual AI/provider assessment.
const pending: HazardEvaluator = async context => ({
  checks: [...systemChecks(context.item, context.state, context.now), ...(["image", "location", "risk"] as const).map(id => ({ id, engine: "AI" as const, status: "inconclusive" as const, confidence: 0.5, reason: "TEST ONLY: controlled pending assessment for integration checks.", evidence: ["Synthetic fixture"] }))],
  verdict: { decision: "needs_verification", confidence: 0.5, reason: "TEST ONLY: assistance request prioritizes officer review.", urgency: "high", origin: "ai", model: "test-fixture-evaluator" },
});

async function setup(t: TestContext, evaluate: HazardEvaluator = pending) {
  const directory = await mkdtemp(join(tmpdir(), "completion-service-test-"));
  t.after(async () => {
    const absolute = resolve(directory);
    assert.equal(dirname(absolute), resolve(tmpdir()));
    assert.ok(basename(absolute).startsWith("completion-service-test-"));
    await rm(absolute, { recursive: true, force: true });
  });
  const store = new LocalHazardStore(join(directory, "state.json"), initialState([destination]));
  store.legacyHazards = async () => [];
  let routeCalls = 0;
  const routeProvider: RouteProvider = async (point, shelter) => {
    routeCalls++;
    return [{ coordinates: [[point.longitude, point.latitude], [shelter.location.longitude, shelter.location.latitude]], distanceM: distanceM(point, shelter.location), durationSeconds: 180 }];
  };
  const service = createHazardService({ store, now, evaluate, routeProvider });
  return { store, service, routeCalls: () => routeCalls };
}

test("a report automatically persists ward, road, responsible council ticket and server-extracted photo assessment", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report());
  assert.equal(item.geography?.status, "mapped");
  assert.equal(item.geography?.fixture, true);
  assert.equal(item.geography?.ward?.id, "DEMO-WARD-NORTH");
  assert.equal(item.geography?.road?.id, "DEMO-ROAD-01");
  assert.equal(item.councilTicket?.councilId, "DEMO-COUNCIL-B");
  assert.equal(item.councilTicket?.assignmentSource, "geography");
  assert.equal(item.councilTicket?.status, "open");
  assert.equal(item.evidence[0].metadata?.status, "gps_missing");
  assert.equal(item.verdict.urgency, "high");
  const persisted = (await store.read()).cases[0];
  assert.deepEqual(persisted.councilTicket, item.councilTicket);
  assert.deepEqual(persisted.geography, item.geography);
});

test("council-scoped officers see only their case details and cannot mutate another council's cases", async t => {
  const { service } = await setup(t);
  const northItem = await service.submitReport(citizen, report());
  const westItem = await service.submitReport({ id: "western-reporter", role: "citizen" }, report({ location: west }));
  assert.deepEqual((await service.snapshot(officerB)).cases.map(item => item.id), [northItem.id]);
  assert.deepEqual((await service.snapshot(officerA)).cases.map(item => item.id), [westItem.id]);
  await assert.rejects(service.reviewCase(officerA, northItem.id, "confirmed", "Attempted review outside authorized council."), status(403));
  await assert.rejects(service.requestEvidence(officerA, northItem.id, "Request evidence outside authorized council."), status(403));
  await assert.rejects(service.addEvidence(officerA, northItem.id, clearance, "Attempted evidence outside authorized council."), status(403));
  await assert.rejects(service.autoRelief({ ...relief, councilIds: ["DEMO-COUNCIL-A"] }, northItem.id, { organization: "TEST relief", resources: "Three beds", people: 3 }), status(403));
  assert.equal((await service.snapshot(officerB)).cases[0].status, "needs_verification");
});

test("manual council assignment validates catalog IDs, uses catalog names and changes officer access", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report({ location: west }));
  await assert.rejects(service.assignCouncil(government, item.id, { councilId: "not-a-configured-council", councilName: "Invented", notes: "Attempt to assign an unknown council." }), status(400));
  const moved = await service.assignCouncil(government, item.id, { councilId: "DEMO-COUNCIL-B", councilName: "CLIENT_SUPPLIED_WRONG_NAME", notes: "Confirmed boundary responsibility with the destination council." });
  assert.equal(moved.councilTicket?.councilName, "Demo Council B");
  assert.equal(moved.councilTicket?.assignmentSource, "officer");
  assert.equal(moved.geography?.ward?.id, "DEMO-WARD-WEST", "A manual council assignment does not rewrite the geographic evidence.");
  assert.equal((await service.snapshot(officerA)).cases.length, 0);
  assert.deepEqual((await service.snapshot(officerB)).cases.map(entry => entry.id), [item.id]);
  assert.equal((await store.read()).cases[0].councilTicket?.councilId, "DEMO-COUNCIL-B");
});

test("human review retains assessment urgency and permits an explicit validated urgency update", async t => {
  const { store, service } = await setup(t);
  const first = await service.submitReport(citizen, report());
  const reviewed = await service.reviewCase(officerB, first.id, "confirmed", "Field officers confirmed the blocked road.");
  assert.equal(reviewed.verdict.urgency, "high");
  assert.equal(reviewed.verdict.origin, "human");
  assert.equal(reviewed.verdict.confidence, null);
  const second = await service.submitReport(citizen, report({ title: "Second assistance report" }));
  const urgent = await service.reviewCase(officerB, second.id, "confirmed", "People are trapped and the response crew requests immediate dispatch.", "critical");
  assert.equal(urgent.verdict.urgency, "critical");
  assert.deepEqual((await service.snapshot(officerB)).cases.map(item => item.id), [second.id, first.id]);
  assert.equal((await store.read()).cases.find(item => item.id === second.id)!.verdict.urgency, "critical");
});

test("a human-reviewed reporter restriction blocks both new reports and added evidence, and an audited lift restores reporting", async t => {
  const { store, service } = await setup(t);
  const rejected = await service.submitReport(citizen, report());
  const pendingItem = await service.submitReport(citizen, report({ title: "Another pending report" }));
  await service.reviewCase(officerB, rejected.id, "rejected", "Officer inspected the site and found this report deliberately false.");
  await service.banReporter(officerB, { reporterId: citizen.id, caseId: rejected.id, reason: "Repeated false reporting established by an officer investigation." });
  await assert.rejects(service.submitReport(citizen, report()), error => status(403)(error) && (error as HazardError).code === "REPORTING_BANNED");
  await assert.rejects(service.addEvidence(citizen, pendingItem.id, clearance, "Attempted additional evidence while reporting is restricted."), error => status(403)(error) && (error as HazardError).code === "REPORTING_BANNED");
  assert.equal((await store.read()).cases.length, 2);
  assert.equal((await store.read()).cases.find(item => item.id === pendingItem.id)!.evidence.length, 1);
  await service.unbanReporter(officerB, { reporterId: citizen.id, reason: "Appeal reviewed; reporting access restored by the council." });
  const reopened = await service.addEvidence(citizen, pendingItem.id, clearance, "Fresh evidence submitted after the restriction was lifted.");
  assert.equal(reopened.evidence.length, 2);
  assert.ok((await store.read()).bans![0].liftedAt);
});

test("confirmation automatically prepares and persists subscribed residents' routes before any snapshot request", async t => {
  const { store, service, routeCalls } = await setup(t);
  const resident: HazardActor = { id: "PRIVATE_NEARBY_RESIDENT", role: "citizen" };
  const location = { latitude: 6.957123, longitude: 79.880321 };
  await service.updateLocation(resident, location, true);
  const item = await service.submitReport(citizen, report());
  assert.equal(routeCalls(), 0);
  await service.reviewCase(officerB, item.id, "confirmed", "Officer confirmed the road hazard and requested area alerts.");
  const state = await store.read();
  const delivery = state.deliveries!.find(entry => entry.recipientId === resident.id);
  assert.ok(delivery, "The mutating confirmation operation prepares durable route delivery without a prior GET.");
  assert.equal(delivery.route.status, "available");
  assert.deepEqual(delivery.location, location);
  assert.ok(delivery.route.screenedHazardIds.includes(item.id));
  assert.ok(routeCalls() > 0);
  const snapshot = await service.snapshot(resident);
  assert.equal(snapshot.alerts.length, 1);
  assert.equal(snapshot.alerts[0].route?.status, "available");
  assert.equal(snapshot.alerts[0].route?.shelter?.id, destination.id);
  assert.deepEqual(snapshot.alerts[0].route?.coordinates[0], [location.longitude, location.latitude]);
});

test("the public map DTO exposes generic hazard geography while excluding photographs, reporter details and resident routes", async t => {
  const { service } = await setup(t);
  await service.updateLocation({ id: "PRIVATE_NEARBY_RESIDENT", role: "citizen" }, { latitude: 6.957123, longitude: 79.880321 }, true);
  const item = await service.submitReport(citizen, report());
  await service.reviewCase(officerB, item.id, "confirmed", "PRIVATE_REVIEW_NOTES should remain inside officer case details.");
  const publicMap = await service.publicSnapshot();
  assert.equal(publicMap.hazards.length, 1);
  assert.equal(publicMap.hazards[0].title, "blocked road hazard");
  assert.equal(publicMap.hazards[0].ward?.id, "DEMO-WARD-NORTH");
  assert.equal(publicMap.hazards[0].road?.closed, true);
  assert.equal(publicMap.hazards[0].urgency, "high");
  assert.deepEqual(publicMap.hazards[0].location, north, "The confirmed hazard location is intentionally public.");
  const serialized = JSON.stringify(publicMap);
  for (const privateValue of [citizen.id, "PRIVATE_REPORT_TITLE", "PRIVATE_REPORT_DESCRIPTION", "PRIVATE_HELP_DETAILS", "PRIVATE_REVIEW_NOTES", "PRIVATE_NEARBY_RESIDENT", "6.957123", "79.880321", photo.dataUrl]) assert.equal(serialized.includes(privateValue), false, privateValue);
  for (const privateKey of ["cases", "residents", "deliveries", "invitations", "bans", "actor", "resident"]) assert.equal(Object.hasOwn(publicMap, privateKey), false, privateKey);
  assert.ok(publicMap.alerts.every(entry => !Object.hasOwn(entry, "route")));
});

test("a nearby road outside a confirmed hazard buffer is shown as a landmark without claiming a road closure", async t => {
  const { service } = await setup(t);
  const item = await service.submitReport(citizen, report({ kind: "fallen_tree", location: { latitude: 6.955, longitude: 79.88 } }));
  assert.ok(item.geography?.road);
  assert.ok(item.geography.road.distanceM > item.radiusM);
  await service.reviewCase(officerB, item.id, "confirmed", "Officer confirmed a fallen tree in a garden away from the nearby road.");
  const publicMap = await service.publicSnapshot();
  assert.equal(publicMap.hazards[0].road?.id, "DEMO-ROAD-01");
  assert.equal(publicMap.hazards[0].road?.closed, false);
});

test("photo clearance resolves the assigned council ticket and removes the public road closure", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report());
  await service.reviewCase(officerB, item.id, "confirmed", "Officer confirmed the obstruction for dispatch.");
  const crew: HazardActor = { id: "test-assigned-crew", role: "ngo" };
  await service.assignCase(officerB, item.id, { id: crew.id, name: "TEST response crew" });
  const closed = await service.closeCase(crew, item.id, clearance, "Crew removed the obstruction and inspected the cleared road.");
  assert.equal(closed.status, "resolved");
  assert.equal(closed.councilTicket?.status, "resolved");
  assert.equal(closed.evidence.at(-1)?.metadata?.status, "gps_missing");
  assert.equal((await store.read()).cases[0].councilTicket?.status, "resolved");
  assert.equal((await service.publicSnapshot()).hazards.length, 0);
});

test("relief coordinators can automatically allocate shelter without receiving officer review or moderation powers", async t => {
  const { service, store } = await setup(t);
  const item = await service.submitReport(citizen, report());
  await assert.rejects(service.reviewCase(relief, item.id, "confirmed", "Relief staff cannot confirm hazard reports."), status(403));
  await assert.rejects(service.submitWeather(relief, { stationId: "TEST-STATION", location: north, rainfallMm: 80, waterLevelM: 5, dangerLevelM: 4, observedAt: new Date(now()).toISOString() }), status(403));
  await assert.rejects(service.banReporter(relief, { reporterId: citizen.id, caseId: item.id, reason: "Relief staff cannot restrict citizen reporting." }), status(403));
  const allocated = await service.autoRelief(relief, item.id, { organization: "TEST relief coordinator", resources: "Three shelter beds and water", people: 3 });
  assert.equal(allocated.relief?.shelterId, destination.id);
  assert.equal(allocated.relief?.route?.status, "available");
  assert.deepEqual(allocated.evidence, [], "Automatic allocation must not bypass relief read restrictions.");
  assert.deepEqual(allocated.checks, []);
  assert.equal((await store.read()).shelters[0].available, 17);
  const queue = await service.snapshot(relief);
  assert.equal(queue.cases.length, 1);
  assert.deepEqual(queue.cases[0].evidence, []);
  assert.deepEqual(queue.cases[0].checks, []);
  const updated = await service.assignRelief(relief, item.id, { organization: "TEST relief", resources: "Two remaining shelter places", shelterId: destination.id, people: 2 });
  assert.deepEqual(updated.evidence, [], "Manual allocation applies the same redaction.");
  assert.deepEqual(updated.checks, []);
  const released = await service.releaseRelief(relief, item.id, "The household has left the shelter; release its capacity.");
  assert.deepEqual(released.evidence, [], "Release responses apply the same redaction.");
  assert.deepEqual(released.checks, []);
  const governmentResponse = await service.assignRelief(officerB, item.id, { organization: "TEST council relief", resources: "Follow-up water delivery" });
  assert.equal(governmentResponse.evidence.length, 1, "Officer access and stored evidence remain intact.");
  assert.equal(governmentResponse.checks.length, 5);
  assert.equal((await store.read()).cases[0].evidence[0].dataUrl, photo.dataUrl);
});

test("requesting information or receiving new evidence reopens the council ticket, preserving review urgency", async t => {
  const { store, service } = await setup(t);
  const item = await service.submitReport(citizen, report());
  const rejected = await service.reviewCase(officerB, item.id, "rejected", "Insufficient current evidence to establish the reported obstruction.");
  assert.equal(rejected.councilTicket?.status, "resolved");
  const requested = await service.requestEvidence(officerB, item.id, "Please provide a wider photograph and an updated observation.");
  assert.equal(requested.status, "needs_verification");
  assert.equal(requested.councilTicket?.status, "open");
  assert.equal(requested.verdict.urgency, "high");
  await service.reviewCase(officerB, item.id, "rejected", "The pending evidence still does not establish the claimed hazard.");
  const additional = await service.addEvidence(citizen, item.id, clearance, "An updated view of the road from a different angle.");
  assert.equal(additional.status, "needs_verification");
  assert.equal(additional.councilTicket?.status, "open");
  assert.equal((await store.read()).cases[0].councilTicket?.status, "open");
});

test("an AI rejection resolves the council ticket in the same persisted evaluation", async t => {
  const rejecting: HazardEvaluator = async context => {
    const result = await pending(context);
    result.checks = result.checks.map(check => check.id === "image" || check.id === "risk" ? { ...check, status: "contradicts", confidence: 0.99 } : check);
    result.verdict = { decision: "rejected", confidence: 0.99, reason: "TEST ONLY: two independent fixture checks contradict the report.", origin: "ai", urgency: "low" };
    return result;
  };
  const { service, store } = await setup(t, rejecting);
  const item = await service.submitReport(citizen, report());
  assert.equal(item.status, "rejected");
  assert.equal(item.councilTicket?.status, "resolved");
  assert.equal((await store.read()).cases[0].councilTicket?.status, "resolved");
});

test("a council can see a global reporting restriction without reading another council's private moderation reason", async t => {
  const { service } = await setup(t);
  const northItem = await service.submitReport(citizen, report());
  await service.submitReport(citizen, report({ location: west }));
  await service.reviewCase(officerB, northItem.id, "rejected", "TEST officer investigation found deliberate false reporting.");
  const privateReason = "PRIVATE_COUNCIL_B_MODERATION_REASON: details from a restricted investigation.";
  await service.banReporter(officerB, { reporterId: citizen.id, caseId: northItem.id, reason: privateReason });
  const councilA = await service.snapshot(officerA);
  assert.equal(councilA.reporters?.[0].banned, true);
  assert.equal(councilA.reporters?.[0].reason, undefined);
  assert.deepEqual(councilA.bans, []);
  assert.equal(JSON.stringify(councilA).includes(privateReason), false);
  const councilB = await service.snapshot(officerB);
  assert.equal(councilB.reporters?.[0].reason, privateReason);
});

test("explicitly unmapped geography vetoes automatic confirmation while legacy fixtures without geography retain their behavior", async t => {
  const { service } = await setup(t);
  const item = await service.submitReport(citizen, report());
  const checks: HazardCheck[] = [
    { id: "weather", engine: "SYSTEM", status: "supports", confidence: 1, reason: "TEST weather corroboration", evidence: ["synthetic weather"] },
    { id: "cluster", engine: "SYSTEM", status: "inconclusive", confidence: 1, reason: "TEST one reporter", evidence: [item.id] },
    ...(["image", "location", "risk"] as const).map(id => ({ id, engine: "AI" as const, status: "supports" as const, confidence: 0.99, reason: "TEST supportive independent assessment", evidence: ["synthetic fixture"] })),
  ];
  const candidate: HazardVerdict = { decision: "confirmed", confidence: 0.99, reason: "TEST model proposes confirmation.", origin: "ai", urgency: "high" };
  assert.equal(enforceVerdict(item, checks, candidate, 0.9).decision, "confirmed", "Mapped geography with complete supportive checks can confirm.");
  for (const status of ["outside_coverage", "unconfigured", "ambiguous"] as const) {
    const result = enforceVerdict({ ...item, geography: { status, fixture: false, source: "TEST geography lookup", reason: "An officer must resolve the administrative location." } }, checks, candidate, 0.9);
    assert.equal(result.decision, "needs_verification", status);
    assert.match(result.reason, /human must verify the location and responsible council/);
    assert.equal(result.urgency, "high");
  }
  const legacy = { ...item };
  delete legacy.geography;
  assert.equal(enforceVerdict(legacy, checks, candidate, 0.9).decision, "confirmed");
});
