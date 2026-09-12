import { randomUUID } from "node:crypto";
import { evaluateHazard, type EvaluationResult, type HazardEvaluator } from "./ai";
import { caseRadius, distanceM, enforceVerdict, systemChecks, unavailableCheck, updateThresholds, WEATHER_WINDOW_MS } from "./engine";
import { fetchOsrmCandidates, routeIntersectsHazard, selectScreenedRoute, type RouteExclusion, type RouteProvider } from "./routing";
import { normalizePolygonExclusions, pointAvoidsPolygons, routeAvoidsPolygons } from "./polygon-safety";
import { createHazardStore, type HazardStore } from "./store";
import { actorSchema, crewSchema, HazardError, notesSchema, parse, pointSchema, reliefSchema, reportSchema, routeCoordinatesSchema, validatePhoto, weatherSchema } from "./validation";
import type { AreaAlert, GeoPoint, HazardActor, HazardCase, HazardEvidence, HazardReportInput, HazardSnapshot, HazardState, PhotoInput, PublicHazard, ReliefInput, RouteScreen, SafeRoute, WeatherInput, WeatherReading } from "./types";

export * from "./types";
export { HazardError } from "./validation";

const active = (item: HazardCase) => item.status === "confirmed" || item.status === "assigned";
const iso = (now: number) => new Date(now).toISOString();
const assertRole = (actor: HazardActor, ...roles: HazardActor["role"][]) => {
  if (!roles.includes(actor.role)) throw new HazardError("Your role cannot perform this action.", 403, "FORBIDDEN");
};
function findCase(state: HazardState, id: string): HazardCase {
  const item = state.cases.find(candidate => candidate.id === id);
  if (!item) throw new HazardError("Hazard case not found.", 404, "NOT_FOUND");
  return item;
}
function change(item: HazardCase, actorId: string, action: string, notes: string, now: number): void {
  item.revision += 1;
  item.updatedAt = iso(now);
  item.history.push({ id: randomUUID(), at: iso(now), actorId, action, notes });
}
function photoEvidence(photo: Awaited<ReturnType<typeof validatePhoto>>, actor: HazardActor, kind: HazardEvidence["kind"], notes: string, now: number): HazardEvidence {
  return { ...photo, id: randomUUID(), kind, notes, uploadedAt: iso(now), uploadedBy: actor.id };
}
function publicHazards(state: HazardState): PublicHazard[] {
  return state.cases.filter(active).map(item => ({ id: item.id, kind: item.kind, title: `${item.source === "weather" && state.weather.find(reading => reading.id === item.weatherReadingId)?.source === "replay" ? "DEMO — " : ""}${item.kind.replaceAll("_", " ")} hazard`, location: item.location, radiusM: item.radiusM, status: item.status as "confirmed" | "assigned", updatedAt: item.updatedAt }));
}
function alert(state: HazardState, item: HazardCase, kind: AreaAlert["kind"], now: number, withdrawn = false): void {
  if (kind !== "weather_warning") {
    for (const previous of state.alerts.filter(entry => entry.caseId === item.id)) previous.expiresAt = iso(now);
  }
  const demo = item.source === "weather" && state.weather.find(reading => reading.id === item.weatherReadingId)?.source === "replay";
  const prefix = demo ? "DEMO — " : "";
  const title = kind === "weather_warning" ? "Weather threshold warning" : kind === "hazard_confirmed" ? `${item.kind.replaceAll("_", " ")} confirmed` : withdrawn ? "Hazard notice withdrawn after review" : "Hazard cleared by response crew";
  const message = kind === "weather_warning"
    ? "A recent weather observation exceeded a rainfall or river threshold in this area. This is an early warning; field verification is still required. Check the hazard map and request route screening before travelling."
    : kind === "hazard_confirmed"
      ? "A hazard has been confirmed in this area. Avoid the marked buffer. Use the route planner to check a route to an available shelter; current road conditions still need local confirmation."
      : withdrawn ? "Government review has withdrawn this hazard notice. The map has been updated. Other warnings and unreported hazards may still apply."
        : "The assigned response crew or government has submitted clearance photo evidence. This hazard has been removed from the active map. Other warnings and unreported hazards may still apply.";
  state.alerts.push({ id: randomUUID(), caseId: item.id, kind, title: `${prefix}${title}`, message: `${demo ? "SIMULATION ONLY. " : ""}${message}`, location: item.location, radiusM: Math.max(2000, item.radiusM), createdAt: iso(now), expiresAt: iso(now + (kind === "weather_warning" ? WEATHER_WINDOW_MS : 24 * 60 * 60_000)) });
}
function exclusions(state: HazardState, now: number): RouteExclusion[] {
  const hazards: RouteExclusion[] = publicHazards(state);
  for (const warning of state.alerts.filter(entry => entry.kind === "weather_warning" && Date.parse(entry.expiresAt) > now)) {
    const item = state.cases.find(candidate => candidate.id === warning.caseId);
    if (item && item.status !== "resolved" && item.status !== "rejected") hazards.push({ id: `weather:${warning.id}`, location: warning.location, radiusM: warning.radiusM });
  }
  return hazards;
}
function restoreShelter(state: HazardState, item: HazardCase): void {
  if (!item.relief?.shelterId || !item.relief.people) return;
  const shelter = state.shelters.find(candidate => candidate.id === item.relief!.shelterId);
  if (!shelter) throw new HazardError("The allocated shelter no longer exists; reconcile its reservation before changing relief.", 409, "SHELTER_MISSING");
  shelter.available = Math.min(shelter.capacity, shelter.available + item.relief.people);
}

export function createHazardService(options: { store: HazardStore; evaluate?: HazardEvaluator; routeProvider?: RouteProvider; now?: () => number }) {
  const store = options.store;
  const evaluate = options.evaluate ?? evaluateHazard;
  const routeProvider = options.routeProvider ?? fetchOsrmCandidates;
  const clock = options.now ?? Date.now;

  async function evaluateCase(id: string, revision: number): Promise<HazardCase> {
    const state = await store.read();
    const item = findCase(state, id);
    if (item.revision !== revision || item.status !== "needs_verification") return item;
    const now = clock();
    const initialSystem = systemChecks(item, state, now);
    let result: EvaluationResult;
    try { result = await evaluate({ item: structuredClone(item), state: structuredClone(state), now }); }
    catch {
      result = { checks: [...initialSystem, ...(["image", "location", "risk"] as const).map(check => unavailableCheck(check, "AI evaluation failed. The report remains saved for human review."))], verdict: { decision: "needs_verification", confidence: null, reason: "AI evaluation failed. Human review is required.", origin: "system" } };
    }
    return store.transaction(current => {
      const latest = findCase(current, id);
      // Never overwrite a human decision or newly submitted evidence while AI was running.
      if (latest.revision !== revision || latest.status !== "needs_verification") return latest;
      const currentTime = clock();
      const currentSystem = systemChecks(latest, current, currentTime);
      if (JSON.stringify(currentSystem) !== JSON.stringify(initialSystem)) {
        latest.checks = [...currentSystem, ...(["image", "location", "risk"] as const).map(check => unavailableCheck(check, "The case context changed while AI was assessing it. These stale assessments were discarded; human review is required."))];
        latest.verdict = { decision: "needs_verification", confidence: null, reason: "New weather or nearby reports changed this case during assessment. Review the current evidence.", origin: "system" };
      } else {
        // SYSTEM checks always come from our code; AI adapters cannot replace them.
        latest.checks = [...currentSystem, ...(["image", "location", "risk"] as const).map(check => result.checks.find(candidate => candidate.id === check && candidate.engine === "AI") ?? unavailableCheck(check, "The AI evaluator omitted this check."))];
        latest.verdict = enforceVerdict(latest, latest.checks, result.verdict, current.thresholds.autoConfirmConfidence);
      }
      latest.status = latest.verdict.decision;
      change(latest, "system", "checks_completed", latest.verdict.reason, currentTime);
      if (latest.status === "confirmed") alert(current, latest, "hazard_confirmed", currentTime);
      return latest;
    });
  }

  return {
    async snapshot(actorInput: HazardActor, point?: GeoPoint): Promise<HazardSnapshot> {
      const actor = parse(actorSchema, actorInput);
      const location = point === undefined ? undefined : parse(pointSchema, point);
      const state = await store.read();
      const now = clock();
      const own = new Set(state.cases.filter(item => item.reportedBy === actor.id).map(item => item.id));
      let cases = state.cases;
      if (actor.role === "citizen") cases = cases.filter(item => own.has(item.id));
      if (actor.role === "ngo") cases = cases.filter(item => own.has(item.id) || item.assignedCrew?.id === actor.id || active(item)).map(item => {
        if (own.has(item.id) || item.assignedCrew?.id === actor.id) return item;
        return { ...item, title: `${item.kind.replaceAll("_", " ")} hazard`, description: "Confirmed hazard. Claim the assignment to access the report evidence and response details.", reportedBy: "redacted", assignedCrew: undefined, needs: item.helpRequested ? "Assistance requested; details available to the assigned crew." : "", checks: [], evidence: [], history: [], relief: undefined, informationRequest: undefined, verdict: { ...item.verdict, reason: "Hazard confirmed. Detailed evidence is restricted to the assigned crew and government reviewers." } };
      });
      const alerts = state.alerts.filter(entry => Date.parse(entry.expiresAt) > now && (actor.role !== "citizen" && !location || own.has(entry.caseId) || location && distanceM(location, entry.location) <= entry.radiusM));
      return { cases: cases.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), hazards: publicHazards(state), alerts: alerts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), weather: state.weather.slice(-50).reverse(), shelters: state.shelters, thresholds: state.thresholds, storageMode: store.mode, fixtureShelters: state.shelters.some(shelter => shelter.fixture), generatedAt: iso(now) };
    },

    async submitReport(actorInput: HazardActor, input: HazardReportInput): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), report = parse(reportSchema, input);
      const photo = await validatePhoto(report.photo);
      if (report.helpRequested && report.needs.trim().length < 3) throw new HazardError("Describe the assistance you need.");
      const now = clock();
      const created = await store.transaction(state => {
        const item: HazardCase = {
          id: randomUUID(), revision: 1, source: "citizen", kind: report.kind, title: report.title, description: report.description, location: report.location, radiusM: caseRadius(report.kind),
          status: "needs_verification", reportedBy: actor.id, createdAt: iso(now), updatedAt: iso(now),
          checks: [], verdict: { decision: "needs_verification", confidence: null, reason: "Report saved. Verification is pending.", origin: "system" },
          evidence: [photoEvidence(photo, actor, "report", "Original citizen report", now)], history: [{ id: randomUUID(), at: iso(now), actorId: actor.id, action: "report_submitted", notes: "Photo and GPS report saved for verification." }],
          helpRequested: report.helpRequested, needs: report.needs,
        };
        state.cases.push(item);
        item.checks = systemChecks(item, state, now);
        return item;
      });
      return evaluateCase(created.id, created.revision);
    },

    async submitWeather(actorInput: HazardActor, input: WeatherInput, source: "operator" | "replay" = "operator"): Promise<{ reading: WeatherReading; case: HazardCase | null }> {
      const actor = parse(actorSchema, actorInput);
      assertRole(actor, "government");
      if (source !== "operator" && source !== "replay") throw new HazardError("Invalid weather source.");
      if (source === "replay" && process.env.NODE_ENV === "production" && process.env.HAZARD_DEMO_MODE !== "true") throw new HazardError("Weather replay requires explicit HAZARD_DEMO_MODE. Simulated warnings cannot be injected into a live deployment.", 403, "DEMO_DISABLED");
      const weather = parse(weatherSchema, input);
      const now = clock(), observed = Date.parse(weather.observedAt);
      if (observed > now + 5 * 60_000 || observed < now - 24 * 60 * 60_000) throw new HazardError("Weather observations must be within the last 24 hours and no more than 5 minutes in the future.");
      // Normalize equivalent timestamps so differing UTC offsets cannot evade idempotency.
      weather.observedAt = iso(observed);
      const result = await store.transaction(state => {
        const duplicate = state.weather.find(reading => reading.stationId === weather.stationId && reading.observedAt === weather.observedAt);
        if (duplicate) {
          if (duplicate.source !== source || duplicate.rainfallMm !== weather.rainfallMm || duplicate.waterLevelM !== weather.waterLevelM || duplicate.dangerLevelM !== weather.dangerLevelM || duplicate.location.latitude !== weather.location.latitude || duplicate.location.longitude !== weather.location.longitude) throw new HazardError("This station already has different data for that observation time.", 409, "WEATHER_CONFLICT");
          return { reading: duplicate, case: duplicate.caseId ? findCase(state, duplicate.caseId) : null, evaluate: false };
        }
        const reading: WeatherReading = { ...weather, id: randomUUID(), receivedAt: iso(now), source };
        state.weather.push(reading);
        const exceeds = weather.rainfallMm >= state.thresholds.rainMm || weather.waterLevelM >= weather.dangerLevelM;
        if (!exceeds || now - observed > WEATHER_WINDOW_MS) return { reading, case: null, evaluate: false };
        let item = state.cases.find(candidate => candidate.source === "weather" && candidate.status !== "resolved" && candidate.status !== "rejected" && distanceM(candidate.location, weather.location) <= 200 && state.weather.find(previous => previous.id === candidate.weatherReadingId)?.stationId === weather.stationId);
        if (!item) {
          item = {
            id: randomUUID(), revision: 1, source: "weather", kind: "flood", title: `${source === "replay" ? "DEMO — " : ""}Flood threshold at ${weather.stationId}`,
            description: `${source === "replay" ? "SIMULATED " : "Operator-submitted "}observation: rainfall ${weather.rainfallMm} mm/hour, river ${weather.waterLevelM} m against danger level ${weather.dangerLevelM} m. Field verification is required.`,
            location: weather.location, radiusM: caseRadius("flood"), status: "needs_verification", reportedBy: actor.id, createdAt: iso(now), updatedAt: iso(now),
            checks: [], verdict: { decision: "needs_verification", confidence: null, reason: "Weather exceeded a threshold; field verification is pending.", origin: "system" }, evidence: [],
            history: [{ id: randomUUID(), at: iso(now), actorId: actor.id, action: "weather_warning_created", notes: `Source: ${source}; weather reading ${reading.id}.` }], helpRequested: false, needs: "", weatherReadingId: reading.id,
          };
          state.cases.push(item);
        } else {
          item.weatherReadingId = reading.id;
          change(item, actor.id, "weather_updated", `New ${source} weather reading ${reading.id} exceeds the threshold.`, now);
        }
        reading.caseId = item.id;
        if (item.status === "needs_verification") item.checks = systemChecks(item, state, now);
        // A persisted area warning exists before any AI call, even when no key or image is available.
        const prior = state.alerts.find(entry => entry.caseId === item!.id && entry.kind === "weather_warning" && Date.parse(entry.createdAt) > now - 30 * 60_000 && Date.parse(entry.expiresAt) > now);
        if (prior) prior.expiresAt = iso(observed + WEATHER_WINDOW_MS);
        else { alert(state, item, "weather_warning", now); state.alerts[state.alerts.length - 1].expiresAt = iso(observed + WEATHER_WINDOW_MS); }
        return { reading, case: item, evaluate: item.status === "needs_verification" };
      });
      return { reading: result.reading, case: result.evaluate && result.case ? await evaluateCase(result.case.id, result.case.revision) : result.case };
    },

    async reviewCase(actorInput: HazardActor, id: string, decision: "confirmed" | "rejected", notesInput: string): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), notes = parse(notesSchema, notesInput);
      assertRole(actor, "government");
      if (decision !== "confirmed" && decision !== "rejected") throw new HazardError("Review decision must be confirmed or rejected.");
      return store.transaction(state => {
        const item = findCase(state, id), now = clock();
        if (item.status === "resolved") throw new HazardError("Resolved hazards cannot be reopened by review. Submit a new report for a new event.", 409, "INVALID_TRANSITION");
        if (item.status === decision || decision === "confirmed" && item.status === "assigned") throw new HazardError("This review decision is already recorded.", 409, "ALREADY_REVIEWED");
        const wasActive = active(item), previousDecision = item.verdict.decision;
        // A label is recorded once per review, with its previous machine/human decision for audit.
        state.feedback.push({ caseId: item.id, at: iso(now), actorId: actor.id, decision, previousDecision, notes });
        item.status = decision;
        item.verdict = { decision, confidence: null, reason: notes, origin: "human" };
        item.informationRequest = undefined;
        if (decision === "rejected") {
          item.assignedCrew = undefined;
          // Shelter reservations remain explicit; rejecting a report does not prove occupants left.
          for (const entry of state.alerts.filter(entry => entry.caseId === item.id)) entry.expiresAt = iso(now);
          if (wasActive) alert(state, item, "hazard_resolved", now, true);
        } else if (!wasActive) alert(state, item, "hazard_confirmed", now);
        updateThresholds(state);
        change(item, actor.id, `human_${decision}`, notes, now);
        return item;
      });
    },

    async requestEvidence(actorInput: HazardActor, id: string, notesInput: string): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), notes = parse(notesSchema, notesInput);
      assertRole(actor, "government");
      return store.transaction(state => {
        const item = findCase(state, id), now = clock();
        if (active(item) || item.status === "resolved") throw new HazardError("Request more information on pending or rejected cases. Active hazards remain published until an explicit rejection or photo clearance.", 409, "INVALID_TRANSITION");
        item.status = "needs_verification";
        item.informationRequest = { notes, requestedAt: iso(now), requestedBy: actor.id };
        item.verdict = { decision: "needs_verification", confidence: null, reason: `Reviewer requested more evidence: ${notes}`, origin: "human" };
        change(item, actor.id, "evidence_requested", notes, now);
        return item;
      });
    },

    async addEvidence(actorInput: HazardActor, id: string, photoInput: PhotoInput, notesInput: string): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), notes = parse(notesSchema, notesInput), photo = await validatePhoto(photoInput);
      const item = await store.transaction(state => {
        const current = findCase(state, id), now = clock();
        if (actor.role !== "government" && current.reportedBy !== actor.id && !(actor.role === "ngo" && current.assignedCrew?.id === actor.id)) throw new HazardError("You can add evidence only to your own report or assigned response.", 403, "FORBIDDEN");
        if (current.status === "resolved") throw new HazardError("This case is resolved. Submit a new report for a new hazard.", 409, "INVALID_TRANSITION");
        if (current.evidence.length >= 20) throw new HazardError("A case can contain at most 20 photos.", 409, "EVIDENCE_LIMIT");
        current.evidence.push(photoEvidence(photo, actor, "additional", notes, now));
        current.informationRequest = undefined;
        if (!active(current)) {
          current.status = "needs_verification";
          current.verdict = { decision: "needs_verification", confidence: null, reason: "New evidence saved. Verification is pending.", origin: "system" };
        }
        change(current, actor.id, "evidence_added", notes, now);
        return current;
      });
      return item.status === "needs_verification" ? evaluateCase(item.id, item.revision) : item;
    },

    async assignCase(actorInput: HazardActor, id: string, crewInput: { id: string; name: string }): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), crew = parse(crewSchema, crewInput);
      assertRole(actor, "government", "ngo");
      if (actor.role === "ngo" && crew.id !== actor.id) throw new HazardError("NGOs can claim assignments only for their own authenticated account.", 403, "FORBIDDEN");
      return store.transaction(state => {
        const item = findCase(state, id), now = clock();
        if (!active(item)) throw new HazardError("Only a confirmed hazard can be assigned to a response crew.", 409, "INVALID_TRANSITION");
        if (actor.role === "ngo" && item.assignedCrew && item.assignedCrew.id !== actor.id) throw new HazardError("Another crew already owns this response. Government can reassign it.", 409, "ALREADY_ASSIGNED");
        item.assignedCrew = { ...crew, assignedAt: iso(now) };
        item.status = "assigned";
        change(item, actor.id, "crew_assigned", `Assigned to ${crew.name} (${crew.id}).`, now);
        return item;
      });
    },

    async closeCase(actorInput: HazardActor, id: string, photoInput: PhotoInput, notesInput: string): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), notes = parse(notesSchema, notesInput), photo = await validatePhoto(photoInput);
      assertRole(actor, "government", "ngo");
      return store.transaction(state => {
        const item = findCase(state, id), now = clock();
        if (item.status !== "assigned" || !item.assignedCrew) throw new HazardError("Assign a confirmed hazard to a response crew before submitting clearance.", 409, "INVALID_TRANSITION");
        if (actor.role === "ngo" && item.assignedCrew.id !== actor.id) throw new HazardError("Only the assigned crew or government can clear this hazard.", 403, "FORBIDDEN");
        if (item.evidence.some(evidence => evidence.dataUrl === photo.dataUrl)) throw new HazardError("Clearance needs a new photo, not a copy of an existing case photo.");
        item.evidence.push(photoEvidence(photo, actor, "closure", notes, now));
        item.status = "resolved";
        change(item, actor.id, "hazard_cleared", notes, now);
        alert(state, item, "hazard_resolved", now);
        return item;
      });
    },

    async assignRelief(actorInput: HazardActor, id: string, reliefInput: ReliefInput): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), relief = parse(reliefSchema, reliefInput);
      assertRole(actor, "government", "ngo");
      let legacy: { id: string; geometry: unknown }[] = [];
      if (relief.shelterId) {
        try { legacy = await store.legacyHazards(); }
        catch { throw new HazardError("Shelter allocation is unavailable because the existing disaster boundaries could not be loaded.", 503, "LEGACY_HAZARDS_UNAVAILABLE"); }
      }
      return store.transaction(state => {
        const item = findCase(state, id), now = clock();
        if (actor.role === "ngo" && item.assignedCrew?.id !== actor.id) throw new HazardError("NGOs can allocate relief only to their assigned cases.", 403, "FORBIDDEN");
        if (item.status === "resolved" || item.status === "rejected") throw new HazardError("Relief can be allocated only to open cases.", 409, "INVALID_TRANSITION");
        if (!item.helpRequested) throw new HazardError("This case has no assistance request.", 409, "NO_HELP_REQUEST");
        restoreShelter(state, item);
        if (relief.shelterId && relief.people) {
          const shelter = state.shelters.find(candidate => candidate.id === relief.shelterId);
          if (!shelter) throw new HazardError("Shelter not found.", 404, "NOT_FOUND");
          if (shelter.available < relief.people) throw new HazardError("The selected shelter has insufficient available capacity.", 409, "SHELTER_FULL");
          if (exclusions(state, now).some(hazard => distanceM(hazard.location, shelter.location) <= hazard.radiusM + 50)) throw new HazardError("This shelter is inside an active hazard or weather-warning buffer.", 409, "SHELTER_UNSAFE");
          if (!pointAvoidsPolygons([shelter.location.longitude, shelter.location.latitude], legacy.map(item => item.geometry))) throw new HazardError("This shelter is inside an active legacy disaster area, or a legacy boundary is missing. Resolve the affected area before allocating this shelter.", 409, "SHELTER_UNSAFE");
          shelter.available -= relief.people;
        }
        item.relief = { ...relief, assignedBy: actor.id, assignedAt: iso(now) };
        change(item, actor.id, "relief_allocated", `${relief.organization}: ${relief.resources}${relief.shelterId ? `; ${relief.people} shelter place(s) at ${relief.shelterId}` : ""}`, now);
        return item;
      });
    },

    async releaseRelief(actorInput: HazardActor, id: string, notesInput: string): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), notes = parse(notesSchema, notesInput);
      assertRole(actor, "government", "ngo");
      return store.transaction(state => {
        const item = findCase(state, id), now = clock();
        if (actor.role === "ngo" && item.assignedCrew?.id !== actor.id) throw new HazardError("Only the assigned crew or government can release this reservation.", 403, "FORBIDDEN");
        if (!item.relief?.shelterId) throw new HazardError("This case has no shelter reservation.", 409, "NO_RESERVATION");
        restoreShelter(state, item);
        item.relief = { ...item.relief, shelterId: undefined, people: undefined };
        change(item, actor.id, "shelter_released", notes, now);
        return item;
      });
    },

    async screenRoute(actorInput: HazardActor, coordinatesInput: [number, number][]): Promise<RouteScreen> {
      parse(actorSchema, actorInput);
      const coordinates = parse(routeCoordinatesSchema, coordinatesInput);
      let legacy: { id: string; geometry: unknown }[];
      try { legacy = await store.legacyHazards(); }
      catch { return { safe: false, reason: "Existing disaster boundaries could not be loaded. The route cannot be screened.", checkedAt: iso(clock()) }; }
      if (!routeAvoidsPolygons(coordinates, legacy.map(item => item.geometry))) return { safe: false, reason: "The route intersects an active disaster area, an active boundary is incomplete, or the route geometry is unusable.", checkedAt: iso(clock()) };
      const state = await store.read(), now = clock();
      if (exclusions(state, now).some(hazard => routeIntersectsHazard(coordinates, hazard))) return { safe: false, reason: "The route crosses a confirmed hazard or active weather-warning buffer.", checkedAt: iso(now) };
      return { safe: true, reason: "This candidate avoids the recorded hazard buffers and active disaster polygons at the checked time. Unreported hazards and current road access remain unknown.", checkedAt: iso(now) };
    },

    async planSafeRoute(actorInput: HazardActor, point: GeoPoint): Promise<SafeRoute> {
      parse(actorSchema, actorInput);
      const location = parse(pointSchema, point);
      const state = await store.read();
      let legacy: { id: string; geometry: unknown }[];
      try { legacy = await store.legacyHazards(); }
      catch {
        return { status: "unavailable", reason: "Active hazard boundaries from the existing disaster map could not be loaded. Routing is unavailable until every map hazard can be screened.", coordinates: [], screenedHazardIds: [], checkedAt: iso(clock()), limitations: ["The legacy disaster boundaries are required to check this route."] };
      }
      if (normalizePolygonExclusions(legacy.map(item => item.geometry)) === null) {
        return { status: "unavailable", reason: "An active disaster on the existing map has a missing or invalid boundary. Routing is unavailable until that boundary is repaired.", coordinates: [], screenedHazardIds: legacy.map(item => `legacy:${item.id}`), checkedAt: iso(clock()), limitations: ["Every active disaster needs a usable boundary before a route can be screened."] };
      }
      const result = await selectScreenedRoute(location, state.shelters, exclusions(state, clock()), clock(), routeProvider, coordinates => routeAvoidsPolygons(coordinates, legacy.map(item => item.geometry)));
      result.screenedHazardIds.push(...legacy.map(item => `legacy:${item.id}`));
      result.limitations.push("Active and monitoring polygons from the existing disaster map are also screened; touching their boundaries is blocked.");
      if (result.status !== "available" || !result.shelter) return result;
      // Re-screen after the network call so concurrent confirmations/capacity changes are respected.
      const latest = await store.read(), now = clock(), currentExclusions = exclusions(latest, now);
      try { legacy = await store.legacyHazards(); } catch { legacy = [{ id: "unavailable", geometry: null }]; }
      const shelter = latest.shelters.find(candidate => candidate.id === result.shelter!.id);
      const screened: [number, number][] = [[location.longitude, location.latitude], ...result.coordinates, [result.shelter.location.longitude, result.shelter.location.latitude]];
      if (!shelter || shelter.available <= 0 || distanceM(shelter.location, result.shelter.location) > 1 || currentExclusions.some(hazard => routeIntersectsHazard(screened, hazard)) || !routeAvoidsPolygons(screened, legacy.map(item => item.geometry))) {
        return { status: "unavailable", reason: "Hazards or shelter availability changed while routing. This route was discarded; request a new route.", coordinates: [], screenedHazardIds: currentExclusions.map(hazard => hazard.id), checkedAt: iso(now), limitations: result.limitations };
      }
      return { ...result, shelter, screenedHazardIds: [...currentExclusions.map(hazard => hazard.id), ...legacy.map(item => `legacy:${item.id}`)], checkedAt: iso(now) };
    },
  };
}

type HazardService = ReturnType<typeof createHazardService>;
let defaultService: Promise<HazardService> | undefined;
async function service(): Promise<HazardService> {
  if (!defaultService) defaultService = createHazardStore().then(store => createHazardService({ store })).catch(error => { defaultService = undefined; throw error; });
  return defaultService;
}
export const snapshot = async (...args: Parameters<HazardService["snapshot"]>) => (await service()).snapshot(...args);
export const submitReport = async (...args: Parameters<HazardService["submitReport"]>) => (await service()).submitReport(...args);
export const submitWeather = async (...args: Parameters<HazardService["submitWeather"]>) => (await service()).submitWeather(...args);
export const reviewCase = async (...args: Parameters<HazardService["reviewCase"]>) => (await service()).reviewCase(...args);
export const requestEvidence = async (...args: Parameters<HazardService["requestEvidence"]>) => (await service()).requestEvidence(...args);
export const addEvidence = async (...args: Parameters<HazardService["addEvidence"]>) => (await service()).addEvidence(...args);
export const assignCase = async (...args: Parameters<HazardService["assignCase"]>) => (await service()).assignCase(...args);
export const closeCase = async (...args: Parameters<HazardService["closeCase"]>) => (await service()).closeCase(...args);
export const assignRelief = async (...args: Parameters<HazardService["assignRelief"]>) => (await service()).assignRelief(...args);
export const releaseRelief = async (...args: Parameters<HazardService["releaseRelief"]>) => (await service()).releaseRelief(...args);
export const screenRoute = async (...args: Parameters<HazardService["screenRoute"]>) => (await service()).screenRoute(...args);
export const planSafeRoute = async (...args: Parameters<HazardService["planSafeRoute"]>) => (await service()).planSafeRoute(...args);
