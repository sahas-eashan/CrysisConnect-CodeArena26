export type UserRole = "citizen" | "ngo" | "government";

export type Disaster = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  severity: string;
  status: string;
  affectedArea?: string | null;
  centerPoint?: string | null;
  radiusKm?: number | null;
  secondaryRisks?: string[] | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SafeZone = {
  id: string;
  name: string;
  location?: string | null;
  boundary?: string | null;
  capacity: number;
  currentOccupancy: number;
  amenities?: string[] | null;
  disasterId?: string | null;
  status?: string | null;
};

export type Resource = {
  id: string;
  name: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  location?: string | null;
  managedBy?: string | null;
  orgId?: string | null;
  disasterId?: string | null;
};

export type ResourceRequest = {
  id: string;
  requestedBy?: string | null;
  resourceId?: string | null;
  resourceName?: string | null;
  quantityNeeded?: number | null;
  urgency?: string | null;
  status?: string | null;
  fulfilledBy?: string | null;
  location?: string | null;
  createdAt?: string | null;
};

export type Profile = {
  id: string;
  role?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  isAvailable?: boolean | null;
  distance?: number | null;
};

export type SOSSignal = {
  id: string;
  senderId?: string | null;
  location?: string | null;
  type?: string | null;
  description?: string | null;
  status?: string | null;
  assignedTo?: string | null;
  disasterId?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
  nearestResponders?: Profile[] | null;
};

export type NewsUpdate = {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  disasterId?: string | null;
  authorId?: string | null;
  createdAt?: string | null;
};

export type Alert = {
  id: string;
  title: string;
  body: string;
  type?: string | null;
  channel?: string[] | null;
  targetArea?: string | null;
  targetRoles?: string[] | null;
  disasterId?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
};

export type Organization = {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  approvalStatus?: string | null;
  createdAt?: string | null;
};

export type DashboardStats = {
  activeDisasters: number;
  pendingSOS: number;
  totalResources: number;
  totalSafeZones: number;
  totalUsers: number;
};

export type AlertResult = {
  sent: number;
  channel: string;
};

export type AiAuditRef = {
  id: string;
  action: string;
  model: string;
  status: string;
  createdAt: string;
  reviewStatus?: string | null;
};

export type AiRiskFlags = {
  blocked: boolean;
  piiDetected: boolean;
  promptInjectionRisk: boolean;
  unsafeContent: boolean;
  reasons: string[];
};

export type AiDecisionRationale = {
  summary: string;
  bullets: string[];
};

export type AiRecommendation = {
  title: string;
  detail: string;
  priority: string;
  relatedIds?: string[] | null;
};

export type AiTranslationSet = {
  english: string;
  sinhala: string;
  tamil: string;
};

export type AiResponseMeta = {
  status: string;
  confidence: number;
  sourceIds: string[];
  warnings: string[];
  requiresHumanApproval: boolean;
  audit: AiAuditRef;
  riskFlags: AiRiskFlags;
};

export type IncidentBrief = {
  meta: AiResponseMeta;
  headline: string;
  summary: string;
  rationale: AiDecisionRationale;
  recommendations: AiRecommendation[];
  translations: AiTranslationSet;
};

export type AlertDraft = {
  meta: AiResponseMeta;
  title: string;
  channel: string[];
  rationale: AiDecisionRationale;
  english: string;
  sinhala: string;
  tamil: string;
};

export type OperationsRecommendationSet = {
  meta: AiResponseMeta;
  timeframe: string;
  rationale: AiDecisionRationale;
  recommendations: AiRecommendation[];
};

export type SosTriage = {
  meta: AiResponseMeta;
  sosId?: string | null;
  severity: string;
  urgency: string;
  responderIds: string[];
  rationale: AiDecisionRationale;
  recommendations: AiRecommendation[];
};

export type ResourceDispatchPlan = {
  meta: AiResponseMeta;
  requestId?: string | null;
  rationale: AiDecisionRationale;
  recommendations: AiRecommendation[];
};

export type CitizenGuidance = {
  meta: AiResponseMeta;
  title: string;
  safeZoneId?: string | null;
  resourceIds: string[];
  nextSteps: string[];
  guidance: AiTranslationSet;
};

export type PreparedSosSubmission = {
  meta: AiResponseMeta;
  original: string;
  refined: string;
  checklist: string[];
  translations: AiTranslationSet;
};

export type MapMarker = {
  id: string;
  longitude: number;
  latitude: number;
  color?: string;
  label: string;
  popup?: string;
  variant?: "pin" | "label" | "info";
};
