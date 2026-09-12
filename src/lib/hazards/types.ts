/** Shared transport types. Dates are UTC ISO strings; coordinates use latitude/longitude. */
export type HazardRole = "citizen" | "ngo" | "government";
export type HazardActor = { id: string; role: HazardRole; name?: string };
export type GeoPoint = { latitude: number; longitude: number };
export type HazardKind = "flood" | "landslide" | "storm" | "tsunami" | "fire" | "blocked_road" | "fallen_tree" | "other";
export type HazardStatus = "needs_verification" | "confirmed" | "rejected" | "assigned" | "resolved";
export type PhotoInput = { dataUrl: string; capturedAt?: string };
export type HazardReportInput = {
  title: string;
  description: string;
  kind: HazardKind;
  location: GeoPoint;
  photo: PhotoInput;
  helpRequested?: boolean;
  needs?: string;
};
export type WeatherInput = {
  stationId: string;
  location: GeoPoint;
  /** Accumulated rainfall during the preceding one hour, in millimetres. */
  rainfallMm: number;
  waterLevelM: number;
  dangerLevelM: number;
  observedAt: string;
};
export type WeatherReading = WeatherInput & { id: string; receivedAt: string; source: "operator" | "replay"; caseId?: string };
export type HazardCheck = {
  id: "weather" | "cluster" | "image" | "location" | "risk";
  engine: "SYSTEM" | "AI";
  status: "supports" | "contradicts" | "inconclusive" | "unavailable" | "not_applicable";
  confidence: number | null;
  reason: string;
  evidence: string[];
};
export type HazardVerdict = {
  decision: "confirmed" | "rejected" | "needs_verification";
  confidence: number | null;
  reason: string;
  origin: "ai" | "system" | "human";
  model?: string;
};
export type HazardEvidence = {
  id: string;
  kind: "report" | "additional" | "closure";
  dataUrl: string;
  mimeType: string;
  capturedAt?: string;
  uploadedAt: string;
  uploadedBy: string;
  notes: string;
};
export type HazardHistory = { id: string; at: string; actorId: string; action: string; notes: string };
export type ReliefInput = { organization: string; resources: string; shelterId?: string; people?: number };
export type ReliefAssignment = ReliefInput & { assignedBy: string; assignedAt: string };
export type HazardCase = {
  id: string;
  revision: number;
  source: "citizen" | "weather";
  kind: HazardKind;
  title: string;
  description: string;
  location: GeoPoint;
  radiusM: number;
  status: HazardStatus;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  checks: HazardCheck[];
  verdict: HazardVerdict;
  evidence: HazardEvidence[];
  history: HazardHistory[];
  assignedCrew?: { id: string; name: string; assignedAt: string };
  helpRequested: boolean;
  needs: string;
  relief?: ReliefAssignment;
  weatherReadingId?: string;
  informationRequest?: { notes: string; requestedAt: string; requestedBy: string };
};
export type AreaAlert = {
  id: string;
  caseId: string;
  kind: "weather_warning" | "hazard_confirmed" | "hazard_resolved";
  title: string;
  message: string;
  location: GeoPoint;
  radiusM: number;
  createdAt: string;
  expiresAt: string;
};
export type PublicHazard = {
  id: string;
  kind: HazardKind;
  title: string;
  location: GeoPoint;
  radiusM: number;
  status: "confirmed" | "assigned";
  updatedAt: string;
};
export type Shelter = {
  id: string;
  name: string;
  location: GeoPoint;
  capacity: number;
  available: number;
  fixture: boolean;
};
export type HazardThresholds = {
  rainMm: number;
  clusterCount: number;
  autoConfirmConfidence: number;
  feedbackCount: number;
};
export type HazardFeedback = { caseId: string; at: string; actorId: string; decision: "confirmed" | "rejected"; previousDecision: string; notes: string };
export type HazardSnapshot = {
  cases: HazardCase[];
  hazards: PublicHazard[];
  alerts: AreaAlert[];
  weather: WeatherReading[];
  shelters: Shelter[];
  thresholds: HazardThresholds;
  storageMode: "local-demo" | "postgres";
  fixtureShelters: boolean;
  generatedAt: string;
};
export type SafeRoute = {
  status: "available" | "unavailable";
  reason: string;
  shelter?: Shelter;
  coordinates: [number, number][];
  distanceM?: number;
  durationSeconds?: number;
  screenedHazardIds: string[];
  checkedAt: string;
  limitations: string[];
};
export type RouteScreen = { safe: boolean; reason: string; checkedAt: string };
export type HazardState = {
  version: 1;
  cases: HazardCase[];
  alerts: AreaAlert[];
  weather: WeatherReading[];
  feedback: HazardFeedback[];
  thresholds: HazardThresholds;
  shelters: Shelter[];
};
