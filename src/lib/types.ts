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

export type MapMarker = {
  id: string;
  longitude: number;
  latitude: number;
  color?: string;
  label: string;
  popup?: string;
  variant?: "pin" | "label" | "info";
};
