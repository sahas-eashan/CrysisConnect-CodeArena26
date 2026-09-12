import assert from "node:assert/strict";
import test from "node:test";
import { assertCanReport, createCommunityOperations } from "../src/lib/hazards/community";
import { initialState, type HazardStore } from "../src/lib/hazards/store";
import type { HazardActor, HazardCase, HazardState } from "../src/lib/hazards/types";
import { HazardError } from "../src/lib/hazards/validation";

const now = Date.parse("2026-09-12T08:00:00Z"), at = new Date(now).toISOString();
const location = { latitude: 6.9, longitude: 79.8 };
const reporter: HazardActor = { id: "original-reporter", role: "citizen" };
const neighbour: HazardActor = { id: "nearby-resident", role: "citizen" };
const officer: HazardActor = { id: "officer", role: "government", councilIds: ["council-a"] };
const photo = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==" };
const differentPhoto = { dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVR4nGNgaGAAIQgFAA4OAgFhGn2EAAAAAElFTkSuQmCC" };
const response = { location, photo: differentPhoto, notes: "Water is visible beside the road.", observation: "supports" as const };
const status = (expected: number, code?: string) => (error: unknown) => error instanceof HazardError && error.status === expected && (!code || error.code === code);

class MemoryStore implements HazardStore {
  readonly mode = "local-demo" as const;
  state = initialState();
  private queue: Promise<unknown> = Promise.resolve();
  async read() { await this.queue; return structuredClone(this.state); }
  async legacyHazards() { return []; }
  async transaction<T>(operation: (state: HazardState) => T): Promise<T> {
    const task = this.queue.then(() => {
      const draft = structuredClone(this.state), result = operation(draft);
      this.state = draft;
      return structuredClone(result);
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}

function setup() {
  const store = new MemoryStore(), evaluations: { id: string; revision: number }[] = [], deliveries: string[] = [];
  const item: HazardCase = {
    id: "case-1", revision: 1, source: "citizen", kind: "flood", title: "PRIVATE household incident", description: "PRIVATE resident and contact details",
    location, radiusM: 500, status: "needs_verification", reportedBy: reporter.id, createdAt: at, updatedAt: at,
    checks: [], verdict: { decision: "needs_verification", confidence: null, origin: "system", reason: "Pending assessment" },
    evidence: [{ id: "original-photo", kind: "report", ...photo, mimeType: "image/png", uploadedAt: at, uploadedBy: reporter.id, notes: "PRIVATE original notes" }], history: [], helpRequested: true, needs: "PRIVATE household assistance",
    councilTicket: { id: "ticket-a", councilId: "council-a", councilName: "Council A", status: "open", assignedAt: at, assignmentSource: "geography" },
  };
  store.state.cases.push(item);
  const operations = createCommunityOperations({
    store, now: () => now,
    evaluateCase: async (id, revision) => { evaluations.push({ id, revision }); return (await store.read()).cases.find(item => item.id === id)!; },
    assertCaseAccess: (actor, item) => { if (!actor.councilIds?.includes(item.councilTicket!.councilId)) throw new HazardError("Council access denied", 403, "FORBIDDEN"); },
    onLocationChanged: async id => { deliveries.push(id); },
  });
  return { store, operations, evaluations, deliveries };
}

async function invite(fixture: ReturnType<typeof setup>) {
  await fixture.operations.updateLocation(neighbour, location);
  await fixture.operations.requestCommunity(officer, "case-1", "Please photograph the road from a safe position.");
  return (await fixture.store.read()).invitations![0];
}

test("community requests select only opted-in nearby residents with fresh GPS and deduplicate invitations", async () => {
  const fixture = setup(), { store, operations } = fixture;
  await operations.updateLocation(neighbour, location);
  await operations.updateLocation(reporter, location);
  await operations.updateLocation({ id: "far", role: "citizen" }, { latitude: 6.91, longitude: 79.8 });
  await operations.updateLocation({ id: "opted-out", role: "citizen" }, location, false);
  await store.transaction(state => {
    state.residents!.push({ id: "stale", location, locationUpdatedAt: new Date(now - 24 * 60 * 60_000 - 1).toISOString(), alertsEnabled: true });
    state.residents!.push({ id: "banned", location, locationUpdatedAt: at, alertsEnabled: true });
    state.bans = [{ reporterId: "banned", bannedBy: officer.id, bannedAt: at, caseId: "past", reason: "Reviewed false reports" }];
  });
  assert.deepEqual(await operations.requestCommunity(officer, "case-1", "Photograph conditions from a safe position."), { invited: 1 });
  assert.deepEqual(await operations.requestCommunity(officer, "case-1", "Photograph conditions from a safe position."), { invited: 0 });
  const state = await store.read();
  assert.equal(state.invitations!.length, 1);
  assert.equal(state.invitations![0].recipientId, neighbour.id);
  assert.equal(JSON.stringify(state.invitations).includes("PRIVATE"), false);
  assert.equal(Date.parse(state.invitations![0].expiresAt) - now, 30 * 60_000);
  await assert.rejects(operations.requestCommunity(reporter, "case-1", "Please send more evidence."), status(403));
  await assert.rejects(operations.requestCommunity({ ...officer, councilIds: ["council-b"] }, "case-1", "Please send more evidence."), status(403));
});

test("a new community photograph is decoded, attributed and reevaluated without exposing the private case", async () => {
  const fixture = setup(), invitation = await invite(fixture);
  const result = await fixture.operations.confirmCommunity(neighbour, invitation.id, { ...response, observation: "contradicts" });
  assert.equal(result.status, "responded");
  assert.deepEqual(result.response, { at, observation: "contradicts" });
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
  assert.equal("evidence" in result, false);
  const item = (await fixture.store.read()).cases[0], evidence = item.evidence[1];
  assert.equal(evidence.kind, "community");
  assert.equal(evidence.uploadedBy, neighbour.id);
  assert.equal(evidence.observation, "contradicts");
  assert.equal(evidence.mimeType, "image/png");
  assert.ok(evidence.metadata);
  assert.equal(item.status, "needs_verification", "A resident's disagreement does not directly reject the hazard.");
  assert.deepEqual(fixture.evaluations, [{ id: item.id, revision: item.revision }]);
  assert.match(item.history.at(-1)!.notes, /not independent location proof/);
});

test("invitation ownership, proximity, expiry and active hazards are checked before accepting any photo", async () => {
  const fixture = setup(), invitation = await invite(fixture), invalid = { ...response, photo: { dataUrl: "invalid image" } };
  await assert.rejects(fixture.operations.confirmCommunity({ id: "outsider", role: "citizen" }, invitation.id, invalid), status(404));
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, { ...invalid, location: { latitude: 7.0, longitude: 79.8 } }), status(403, "NOT_NEARBY"));
  await fixture.store.transaction(state => { state.invitations![0].expiresAt = at; });
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, invalid), status(409, "INVITATION_INACTIVE"));
  await fixture.store.transaction(state => { state.invitations![0].expiresAt = new Date(now + 10000).toISOString(); state.cases[0].status = "confirmed"; });
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, invalid), status(409, "CASE_NOT_PENDING"));
  assert.equal((await fixture.store.read()).cases[0].evidence.length, 1);
});

test("duplicate bytes and simultaneous reuse cannot manufacture independent community confirmations", async () => {
  const fixture = setup(), invitation = await invite(fixture);
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, { ...response, photo: { ...photo, capturedAt: at } }), status(409, "DUPLICATE_EVIDENCE"));
  const attempts = await Promise.allSettled([
    fixture.operations.confirmCommunity(neighbour, invitation.id, response),
    fixture.operations.confirmCommunity(neighbour, invitation.id, response),
  ]);
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(result => result.status === "rejected").length, 1);
  assert.equal((await fixture.store.read()).cases[0].evidence.length, 2);
  assert.equal(fixture.evaluations.length, 1);
});

test("empty community, self-confirmation, stale stored GPS and evidence limit fail closed", async () => {
  const fixture = setup();
  await assert.rejects(fixture.operations.requestCommunity(officer, "case-1", "Please send more evidence."), status(409, "NO_NEARBY_RESIDENTS"));
  const invitation = await invite(fixture);
  await fixture.store.transaction(state => { state.residents![0].locationUpdatedAt = new Date(now - 24 * 60 * 60_000 - 1).toISOString(); });
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, response), status(403, "NOT_NEARBY"));
  await fixture.operations.updateLocation(neighbour, location);
  await fixture.store.transaction(state => { state.cases[0].reportedBy = neighbour.id; });
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, response), status(403, "SELF_CONFIRMATION"));
  await fixture.store.transaction(state => { state.cases[0].reportedBy = reporter.id; state.cases[0].evidence = Array.from({ length: 20 }, (_, index) => ({ ...state.cases[0].evidence[0], id: `photo-${index}` })); });
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, response), status(409, "EVIDENCE_LIMIT"));
});

test("only scoped officers can ban a matching human-rejected reporter; restrictions are reversible and audited", async () => {
  const fixture = setup(), { operations, store } = fixture;
  const request = { reporterId: reporter.id, caseId: "case-1", reason: "Repeated fabricated reports established during officer review." };
  await assert.rejects(operations.banReporter(neighbour, request), status(403));
  await assert.rejects(operations.banReporter(officer, request), status(409, "HUMAN_REJECTION_REQUIRED"));
  await store.transaction(state => { Object.assign(state.cases[0], { status: "rejected", verdict: { decision: "rejected", confidence: 0.99, reason: "AI rejection", origin: "ai" } }); });
  await assert.rejects(operations.banReporter(officer, request), status(409, "HUMAN_REJECTION_REQUIRED"));
  await store.transaction(state => { state.cases[0].verdict.origin = "human"; state.invitations = [{ id: "reporter-invite", caseId: "other", recipientId: reporter.id, title: "Independent report", location, notes: "Please send evidence", requestedAt: at, expiresAt: new Date(now + 10000).toISOString(), status: "pending" }]; });
  await assert.rejects(operations.banReporter({ ...officer, councilIds: ["council-b"] }, request), status(403));
  const ban = await operations.banReporter(officer, request);
  assert.deepEqual(await operations.banReporter(officer, request), ban);
  let state = await store.read();
  assert.equal(state.bans!.length, 1);
  assert.equal(state.invitations![0].status, "cancelled");
  assert.throws(() => assertCanReport(state, reporter), status(403, "REPORTING_BANNED"));
  assert.doesNotThrow(() => assertCanReport(state, neighbour));
  await assert.rejects(operations.unbanReporter({ ...officer, councilIds: ["council-b"] }, { reporterId: reporter.id, reason: "Appeal was accepted." }), status(403));
  const lifted = await operations.unbanReporter(officer, { reporterId: reporter.id, reason: "Appeal reviewed and reporting access restored." });
  assert.equal(lifted.liftedBy, officer.id);
  assert.equal(lifted.liftedAt, at);
  state = await store.read();
  assert.doesNotThrow(() => assertCanReport(state, reporter));
  assert.deepEqual(state.cases[0].history.map(event => event.action), ["reporter_banned", "reporter_unbanned"]);
  await assert.rejects(operations.unbanReporter(officer, { reporterId: reporter.id, reason: "Duplicate appeal action." }), status(409, "NO_ACTIVE_BAN"));
});

test("a ban blocks an already-issued invitation and invalid human-review cases cannot be used for moderation", async () => {
  const fixture = setup(), invitation = await invite(fixture);
  await fixture.store.transaction(state => { state.bans = [{ reporterId: neighbour.id, caseId: "other", bannedAt: at, bannedBy: officer.id, reason: "Reviewed false report" }]; });
  await assert.rejects(fixture.operations.confirmCommunity(neighbour, invitation.id, response), status(403, "REPORTING_BANNED"));
  await fixture.store.transaction(state => { state.cases[0].status = "rejected"; state.cases[0].verdict = { decision: "rejected", confidence: null, reason: "Human decision", origin: "human" }; });
  await assert.rejects(fixture.operations.banReporter(officer, { reporterId: neighbour.id, caseId: "case-1", reason: "A different reporter's report." }), status(409, "HUMAN_REJECTION_REQUIRED"));
  await fixture.store.transaction(state => { state.cases[0].source = "weather"; });
  await assert.rejects(fixture.operations.banReporter(officer, { reporterId: reporter.id, caseId: "case-1", reason: "A weather station warning." }), status(409, "HUMAN_REJECTION_REQUIRED"));
  await assert.rejects(fixture.operations.banReporter(officer, { reporterId: officer.id, caseId: "case-1", reason: "Self moderation attempt." }), status(403, "SELF_MODERATION"));
});

test("an idempotent ban request cannot disclose another council's existing private restriction", async () => {
  const { store, operations } = setup();
  await store.transaction(state => {
    state.cases[0].status = "rejected";
    state.cases[0].verdict = { decision: "rejected", confidence: null, origin: "human", reason: "Council A completed its independent review." };
    state.cases.push({ ...structuredClone(state.cases[0]), id: "private-council-b-case", councilTicket: { ...state.cases[0].councilTicket!, councilId: "council-b", councilName: "Council B" } });
    state.bans = [{ reporterId: reporter.id, caseId: "private-council-b-case", reason: "PRIVATE_COUNCIL_B_INVESTIGATION_DETAILS", bannedAt: at, bannedBy: "officer-b" }];
  });
  await assert.rejects(operations.banReporter(officer, { reporterId: reporter.id, caseId: "case-1", reason: "Council A requests a restriction after its own human review." }), status(403));
  const state = await store.read();
  assert.equal(state.bans!.length, 1);
  assert.equal(state.bans![0].reason, "PRIVATE_COUNCIL_B_INVESTIGATION_DETAILS");
  assert.equal(state.cases[0].history.length, 0);
});

test("location changes clear prior routes; forgetting removes recipient GPS, deliveries and invitations only", async () => {
  const fixture = setup(), invitation = await invite(fixture);
  await fixture.operations.updateLocation(reporter, location);
  await fixture.store.transaction(state => { state.deliveries = [{ recipientId: neighbour.id, alertId: "warning", location, preparedAt: at, route: { status: "unavailable", reason: "No route", coordinates: [], checkedAt: at, screenedHazardIds: [], limitations: [] } }]; });
  await fixture.operations.updateLocation(neighbour, location, false);
  let state = await fixture.store.read();
  assert.equal(state.deliveries!.length, 0);
  assert.equal(state.invitations!.find(item => item.id === invitation.id)!.status, "cancelled");
  assert.deepEqual(fixture.deliveries, [neighbour.id, reporter.id], "Opt-out never triggers automatic route preparation.");
  await fixture.operations.forgetLocation(neighbour);
  state = await fixture.store.read();
  assert.equal(state.residents!.some(resident => resident.id === neighbour.id), false);
  assert.equal(state.invitations!.some(item => item.recipientId === neighbour.id), false);
  assert.equal(state.residents!.some(resident => resident.id === reporter.id), true);
  assert.equal(state.cases[0].evidence.length, 1);
  await assert.rejects(fixture.operations.updateLocation(officer, location), status(403));
});
