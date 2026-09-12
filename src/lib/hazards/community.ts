import { randomUUID } from "node:crypto";
import { z } from "zod";
import { distanceM } from "./engine";
import type { HazardStore } from "./store";
import type { CommunityInvitation, GeoPoint, HazardActor, HazardCase, HazardState, PhotoInput, ResidentProfile } from "./types";
import { actorSchema, HazardError, notesSchema, parse, photoSchema, pointSchema, validatePhoto } from "./validation";

const iso = (now: number) => new Date(now).toISOString();
const idSchema = z.string().trim().min(1).max(200);
const responseSchema = z.object({ location: pointSchema, photo: photoSchema, notes: notesSchema, observation: z.enum(["supports", "contradicts"]) }).strict();
const banSchema = z.object({ reporterId: idSchema, reason: notesSchema, caseId: idSchema }).strict();
const unbanSchema = banSchema.omit({ caseId: true });
const LOCATION_AGE_MS = 24 * 60 * 60_000;
const INVITATION_AGE_MS = 30 * 60_000;

export function assertCanReport(state: HazardState, actor: HazardActor): void {
  if (state.bans?.some(ban => ban.reporterId === actor.id && !ban.liftedAt)) throw new HazardError("Reporting is suspended after officer review. Contact the responsible council to appeal this restriction.", 403, "REPORTING_BANNED");
}

function requireRole(actor: HazardActor, role: HazardActor["role"]): void {
  if (actor.role !== role) throw new HazardError("Your role cannot perform this action.", 403, "FORBIDDEN");
}

function caseById(state: HazardState, id: string): HazardCase {
  const item = state.cases.find(item => item.id === id);
  if (!item) throw new HazardError("Hazard case not found.", 404, "NOT_FOUND");
  return item;
}

function nearby(profile: ResidentProfile | undefined, location: GeoPoint, now: number): boolean {
  const age = now - Date.parse(profile?.locationUpdatedAt || "");
  return !!profile?.alertsEnabled && !!profile.location && age >= 0 && age <= LOCATION_AGE_MS && distanceM(profile.location, location) <= 200;
}

function change(item: HazardCase, actorId: string, action: string, notes: string, now: number): void {
  item.revision++;
  item.updatedAt = iso(now);
  item.history.push({ id: randomUUID(), at: iso(now), actorId, action, notes });
}

function pendingCase(item: HazardCase): void {
  if (item.status !== "needs_verification") throw new HazardError("Community evidence is accepted only while this report awaits verification.", 409, "CASE_NOT_PENDING");
}

function confirmationAccess(state: HazardState, actor: HazardActor, id: string, location: GeoPoint, now: number): { invitation: CommunityInvitation; item: HazardCase } {
  assertCanReport(state, actor);
  const invitation = state.invitations?.find(invitation => invitation.id === id && invitation.recipientId === actor.id);
  if (!invitation) throw new HazardError("Community invitation not found.", 404, "NOT_FOUND");
  if (invitation.status !== "pending" || Date.parse(invitation.expiresAt) <= now || !Number.isFinite(Date.parse(invitation.expiresAt))) throw new HazardError("This invitation has expired or already been used.", 409, "INVITATION_INACTIVE");
  const item = caseById(state, invitation.caseId);
  pendingCase(item);
  if (item.reportedBy === actor.id) throw new HazardError("A reporter cannot provide independent community confirmation of their own report.", 403, "SELF_CONFIRMATION");
  if (!nearby(state.residents?.find(profile => profile.id === actor.id), item.location, now) || distanceM(location, item.location) > 200) throw new HazardError("Share a current location within 200 m of this report before responding. Location is supplied by the device and is not independent proof.", 403, "NOT_NEARBY");
  if (item.evidence.some(evidence => evidence.kind === "community" && evidence.uploadedBy === actor.id)) throw new HazardError("You have already provided community evidence for this report.", 409, "ALREADY_CONFIRMED");
  if (item.evidence.length >= 20) throw new HazardError("This report already has the maximum number of evidence photos.", 409, "EVIDENCE_LIMIT");
  return { invitation, item };
}

export function createCommunityOperations(options: {
  store: HazardStore;
  now: () => number;
  evaluateCase: (id: string, revision: number) => Promise<HazardCase>;
  assertCaseAccess: (actor: HazardActor, item: HazardCase) => void;
  onLocationChanged?: (actorId: string) => Promise<void>;
}) {
  const { store, now: clock, assertCaseAccess } = options;
  return {
    async updateLocation(actorInput: HazardActor, locationInput: GeoPoint, alertsEnabled = true): Promise<ResidentProfile> {
      const actor = parse(actorSchema, actorInput);
      requireRole(actor, "citizen");
      const location = parse(pointSchema, locationInput), enabled = parse(z.boolean(), alertsEnabled);
      const result = await store.transaction(state => {
        const residents = state.residents ??= [];
        const resident = residents.find(resident => resident.id === actor.id) ?? { id: actor.id, alertsEnabled: enabled };
        if (!residents.includes(resident)) residents.push(resident);
        Object.assign(resident, { location, locationUpdatedAt: iso(clock()), alertsEnabled: enabled });
        state.deliveries = (state.deliveries ?? []).filter(delivery => delivery.recipientId !== actor.id);
        if (!enabled) for (const invitation of state.invitations ?? []) if (invitation.recipientId === actor.id && invitation.status === "pending") invitation.status = "cancelled";
        return resident;
      });
      if (enabled) await options.onLocationChanged?.(actor.id);
      return result;
    },

    async forgetLocation(actorInput: HazardActor): Promise<{ removed: true }> {
      const actor = parse(actorSchema, actorInput);
      requireRole(actor, "citizen");
      await store.transaction(state => {
        state.residents = (state.residents ?? []).filter(resident => resident.id !== actor.id);
        state.deliveries = (state.deliveries ?? []).filter(delivery => delivery.recipientId !== actor.id);
        state.invitations = (state.invitations ?? []).filter(invitation => invitation.recipientId !== actor.id);
      });
      return { removed: true };
    },

    async requestCommunity(actorInput: HazardActor, idInput: string, notesInput: string): Promise<{ invited: number }> {
      const actor = parse(actorSchema, actorInput);
      requireRole(actor, "government");
      const id = parse(idSchema, idInput), notes = parse(notesSchema, notesInput);
      return store.transaction(state => {
        const item = caseById(state, id), now = clock();
        assertCaseAccess(actor, item);
        pendingCase(item);
        const banned = new Set((state.bans ?? []).filter(ban => !ban.liftedAt).map(ban => ban.reporterId));
        const candidates = (state.residents ?? []).filter(resident => resident.id !== item.reportedBy && !banned.has(resident.id) && nearby(resident, item.location, now));
        if (!candidates.length) throw new HazardError("No opted-in residents with a recent location are available within 200 m.", 409, "NO_NEARBY_RESIDENTS");
        const invitations = state.invitations ??= [];
        let invited = 0;
        for (const resident of candidates) {
          if (invitations.some(invitation => invitation.caseId === id && invitation.recipientId === resident.id && (invitation.status === "responded" || invitation.status === "pending" && Date.parse(invitation.expiresAt) > now)) || item.evidence.some(evidence => evidence.kind === "community" && evidence.uploadedBy === resident.id)) continue;
          invitations.push({ id: randomUUID(), caseId: id, recipientId: resident.id, title: `${item.kind.replaceAll("_", " ")} report: nearby observations requested`, location: structuredClone(item.location), notes, requestedAt: iso(now), expiresAt: iso(now + INVITATION_AGE_MS), status: "pending" });
          invited++;
        }
        if (invited) change(item, actor.id, "community_requested", `Requested observations from ${invited} nearby opted-in residents. ${notes}`, now);
        return { invited };
      });
    },

    async confirmCommunity(actorInput: HazardActor, invitationIdInput: string, input: { location: GeoPoint; photo: PhotoInput; notes: string; observation: "supports" | "contradicts" }): Promise<CommunityInvitation> {
      const actor = parse(actorSchema, actorInput);
      requireRole(actor, "citizen");
      const invitationId = parse(idSchema, invitationIdInput), response = parse(responseSchema, input);
      const before = confirmationAccess(await store.read(), actor, invitationId, response.location, clock());
      const photo = await validatePhoto(response.photo, before.item.location);
      const saved = await store.transaction(state => {
        const now = clock(), { invitation, item } = confirmationAccess(state, actor, invitationId, response.location, now);
        const imageBytes = photo.dataUrl.slice(photo.dataUrl.indexOf(",") + 1);
        if (item.evidence.some(evidence => evidence.dataUrl.slice(evidence.dataUrl.indexOf(",") + 1) === imageBytes)) throw new HazardError("Submit a new photograph; an existing report photo cannot serve as independent community evidence.", 409, "DUPLICATE_EVIDENCE");
        item.evidence.push({ ...photo, id: randomUUID(), kind: "community", notes: response.notes, uploadedAt: iso(now), uploadedBy: actor.id, observation: response.observation });
        invitation.status = "responded";
        invitation.response = { at: iso(now), observation: response.observation };
        change(item, actor.id, "community_evidence_added", `${response.observation}: ${response.notes}. Device-supplied proximity is not independent location proof.`, now);
        return { invitation, caseId: item.id, revision: item.revision };
      });
      await options.evaluateCase(saved.caseId, saved.revision);
      return saved.invitation;
    },

    async banReporter(actorInput: HazardActor, input: { reporterId: string; reason: string; caseId: string }) {
      const actor = parse(actorSchema, actorInput);
      requireRole(actor, "government");
      const request = parse(banSchema, input);
      if (request.reporterId === actor.id) throw new HazardError("You cannot moderate your own account.", 403, "SELF_MODERATION");
      return store.transaction(state => {
        const item = caseById(state, request.caseId);
        assertCaseAccess(actor, item);
        if (item.source !== "citizen" || item.reportedBy !== request.reporterId || item.status !== "rejected" || item.verdict.decision !== "rejected" || item.verdict.origin !== "human") throw new HazardError("A reporting restriction requires a matching citizen report rejected by a human officer. An AI assessment alone cannot ban a reporter.", 409, "HUMAN_REJECTION_REQUIRED");
        const bans = state.bans ??= [];
        const existing = bans.find(ban => ban.reporterId === request.reporterId && !ban.liftedAt);
        if (existing) {
          assertCaseAccess(actor, caseById(state, existing.caseId));
          return existing;
        }
        const now = clock(), ban = { ...request, bannedAt: iso(now), bannedBy: actor.id };
        bans.push(ban);
        for (const invitation of state.invitations ?? []) if (invitation.recipientId === request.reporterId && invitation.status === "pending") invitation.status = "cancelled";
        change(item, actor.id, "reporter_banned", request.reason, now);
        return ban;
      });
    },

    async unbanReporter(actorInput: HazardActor, input: { reporterId: string; reason: string }) {
      const actor = parse(actorSchema, actorInput);
      requireRole(actor, "government");
      const request = parse(unbanSchema, input);
      if (request.reporterId === actor.id) throw new HazardError("You cannot moderate your own account.", 403, "SELF_MODERATION");
      return store.transaction(state => {
        const ban = state.bans?.find(ban => ban.reporterId === request.reporterId && !ban.liftedAt);
        if (!ban) throw new HazardError("This reporter has no active restriction to lift.", 409, "NO_ACTIVE_BAN");
        const item = caseById(state, ban.caseId);
        assertCaseAccess(actor, item);
        const now = clock();
        Object.assign(ban, { liftedAt: iso(now), liftedBy: actor.id, liftReason: request.reason });
        change(item, actor.id, "reporter_unbanned", request.reason, now);
        return ban;
      });
    },
  };
}
