import type { GeoPoint, HazardCase, HazardCheck, HazardState, HazardVerdict, WeatherReading } from "./types";

export const CLUSTER_RADIUS_M = 200;
export const CLUSTER_WINDOW_MS = 2 * 60 * 60_000;
export const WEATHER_WINDOW_MS = 2 * 60 * 60_000;
export const WEATHER_RADIUS_M = 10_000;

export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}

export function caseRadius(kind: HazardCase["kind"]): number {
  return { flood: 500, landslide: 400, storm: 1000, tsunami: 2000, fire: 300, blocked_road: 120, fallen_tree: 100, other: 250 }[kind];
}

export function relevantWeather(state: HazardState, location: GeoPoint, now: number): WeatherReading[] {
  return state.weather.filter(reading => {
    const age = now - Date.parse(reading.observedAt);
    return age >= -5 * 60_000 && age <= WEATHER_WINDOW_MS && distanceM(reading.location, location) <= WEATHER_RADIUS_M;
  }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}

export function systemChecks(item: HazardCase, state: HazardState, now: number): HazardCheck[] {
  const readings = relevantWeather(state, item.location, now);
  const latestByStation = [...new Map([...readings].reverse().map(reading => [reading.stationId, reading])).values()];
  const floodContext = ["flood", "landslide", "storm", "blocked_road", "fallen_tree"].includes(item.kind);
  const supports = latestByStation.filter(reading => reading.rainfallMm >= state.thresholds.rainMm || reading.waterLevelM >= reading.dangerLevelM);
  const weather: HazardCheck = {
    id: "weather", engine: "SYSTEM", status: !readings.length ? "unavailable" : supports.length && floodContext ? "supports" : "inconclusive", confidence: readings.length ? 1 : null,
    reason: !readings.length ? "No weather observation within 10 km and the last 2 hours is available." : supports.length && floodContext ? `A recent station reading exceeds rainfall ${state.thresholds.rainMm} mm/hour or its river danger level. This supports environmental risk, not proof of the report.` : "Available weather readings do not independently establish this hazard; readings below a threshold do not disprove a citizen report.",
    evidence: latestByStation.map(reading => `${reading.id}: ${reading.stationId}, ${reading.rainfallMm} mm/hour, river ${reading.waterLevelM}/${reading.dangerLevelM} m, ${reading.observedAt}, ${reading.source}`),
  };
  const nearby = state.cases.filter(candidate => candidate.source === "citizen" && candidate.kind === item.kind && candidate.status !== "rejected" && candidate.status !== "resolved" && now - Date.parse(candidate.createdAt) <= CLUSTER_WINDOW_MS && distanceM(candidate.location, item.location) <= CLUSTER_RADIUS_M);
  // Repeated reports from one account never manufacture independent corroboration.
  const banned = new Set((state.bans ?? []).filter(ban => !ban.liftedAt).map(ban => ban.reporterId));
  const corroboration = item.evidence.filter(evidence => evidence.kind === "community" && evidence.observation === "supports" && now - Date.parse(evidence.uploadedAt) <= CLUSTER_WINDOW_MS && evidence.metadata?.status !== "gps_mismatch");
  const independent = new Set([...nearby.map(candidate => candidate.reportedBy), ...corroboration.map(evidence => evidence.uploadedBy)].filter(id => !banned.has(id))).size;
  const cluster: HazardCheck = {
    id: "cluster", engine: "SYSTEM", status: independent >= state.thresholds.clusterCount ? "supports" : "inconclusive", confidence: 1,
    reason: `${independent} distinct reporter(s) describe ${item.kind.replaceAll("_", " ")} within 200 m and 2 hours; ${state.thresholds.clusterCount} are required for corroboration. Account independence is not proof of eyewitness independence.`,
    evidence: [...nearby.map(candidate => candidate.id), ...corroboration.map(evidence => `community:${evidence.id}`)],
  };
  return [weather, cluster];
}

export function unavailableCheck(id: "image" | "location" | "risk", reason: string): HazardCheck {
  return { id, engine: "AI", status: "unavailable", confidence: null, reason, evidence: [] };
}

/** A model recommendation is gated by evidence completeness and conservative policy. */
export function enforceVerdict(item: HazardCase, checks: HazardCheck[], candidate: HazardVerdict, threshold: number): HazardVerdict {
  if (candidate.decision === "confirmed" && item.evidence.some(evidence => evidence.kind !== "closure" && evidence.metadata?.status === "gps_mismatch")) return {
    ...candidate, decision: "needs_verification", reason: "Photo GPS metadata conflicts with the reported location. A human must resolve this conflict before confirmation.",
  };
  if (candidate.decision === "confirmed" && item.evidence.some(evidence => evidence.kind === "community" && evidence.observation === "contradicts")) return {
    ...candidate, decision: "needs_verification", reason: "A nearby resident disputes this hazard. Human review must resolve the conflicting observations.",
  };
  const applicableAI = checks.filter(check => check.engine === "AI" && check.status !== "not_applicable");
  if (applicableAI.length < 2 || applicableAI.some(check => check.status === "unavailable")) {
    return { decision: "needs_verification", confidence: null, reason: "AI verification is incomplete. A government reviewer must assess the evidence before this report becomes a confirmed hazard.", origin: "system", urgency: "unknown" };
  }
  // An explicitly failed lookup cannot be overridden by a confident model recommendation.
  // Older v1 records without geography preserve their prior behavior until enriched by the service.
  if (candidate.decision === "confirmed" && item.geography && item.geography.status !== "mapped") return {
    ...candidate, decision: "needs_verification", reason: `Geographic lookup is ${item.geography.status.replaceAll("_", " ")}. A human must verify the location and responsible council before confirmation.`,
  };
  const confidence = candidate.confidence;
  const noContradictions = !checks.some(check => check.status === "contradicts");
  const systemSupport = checks.some(check => check.engine === "SYSTEM" && check.status === "supports");
  const imageSupport = item.source === "weather" || checks.some(check => check.id === "image" && check.status === "supports" && (check.confidence ?? 0) >= 0.7);
  const riskSupport = checks.some(check => check.id === "risk" && check.status === "supports");
  if (candidate.decision === "confirmed" && confidence !== null && confidence >= threshold && noContradictions && systemSupport && imageSupport && riskSupport) return candidate;
  if (candidate.decision === "rejected" && confidence !== null && confidence >= 0.95 && checks.filter(check => check.status === "contradicts").length >= 2) return candidate;
  return { ...candidate, decision: "needs_verification", reason: `${candidate.reason} Human review is required: auto-confirmation needs complete AI checks, corroborating SYSTEM evidence, a supported risk check, no contradictions and confidence at least ${Math.round(threshold * 100)}%.` };
}

/** Feedback affects only a bounded operational threshold; it does not claim calibrated AI accuracy. */
export function updateThresholds(state: HazardState): void {
  const latest = [...new Map(state.feedback.map(feedback => [feedback.caseId, feedback])).values()];
  state.thresholds.feedbackCount = latest.length;
  let threshold = 0.9;
  for (const feedback of latest) {
    if (feedback.decision === "rejected" && feedback.previousDecision === "confirmed") threshold += 0.02;
    else if (feedback.decision === "confirmed" && feedback.previousDecision === "needs_verification") threshold -= 0.002;
  }
  state.thresholds.autoConfirmConfidence = Math.round(Math.min(0.98, Math.max(0.85, threshold)) * 1000) / 1000;
}
