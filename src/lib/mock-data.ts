import type {
  DashboardStats,
  Disaster,
  NewsUpdate,
  Organization,
  Resource,
  ResourceRequest,
  SOSSignal,
  SafeZone
} from "@/lib/types";

export const mockDisasters: Disaster[] = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Colombo Urban Flood",
    description: "Heavy rainfall has flooded low-lying roads and homes.",
    type: "flood",
    severity: "high",
    status: "active",
    centerPoint: JSON.stringify({ type: "Point", coordinates: [79.871, 6.932] }),
    radiusKm: 5,
    secondaryRisks: ["water contamination", "disease outbreak"],
    createdAt: new Date().toISOString()
  }
];

export const mockSafeZones: SafeZone[] = [
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Independence Hall Shelter",
    location: JSON.stringify({ type: "Point", coordinates: [79.8671, 6.9049] }),
    capacity: 500,
    currentOccupancy: 180,
    amenities: ["medical", "food", "charging"],
    disasterId: mockDisasters[0].id,
    status: "active"
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Sugathadasa Indoor Camp",
    location: JSON.stringify({ type: "Point", coordinates: [79.8778, 6.9492] }),
    capacity: 650,
    currentOccupancy: 420,
    amenities: ["beds", "medical", "water"],
    disasterId: mockDisasters[0].id,
    status: "active"
  }
];

export const mockResources: Resource[] = [
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Bottled Water Packs",
    category: "water",
    quantity: 700,
    unit: "packs",
    status: "available",
    location: JSON.stringify({ type: "Point", coordinates: [79.873, 6.9285] }),
    managedBy: "ngo-demo-1"
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    name: "First Aid Kits",
    category: "medical",
    quantity: 80,
    unit: "kits",
    status: "low",
    location: JSON.stringify({ type: "Point", coordinates: [79.8695, 6.9358] }),
    managedBy: "ngo-demo-2"
  }
];

export const mockResourceRequests: ResourceRequest[] = [
  {
    id: "77777777-7777-7777-7777-777777777777",
    requestedBy: "citizen-demo-1",
    resourceName: "Dry food packs",
    quantityNeeded: 20,
    urgency: "high",
    status: "pending",
    location: JSON.stringify({ type: "Point", coordinates: [79.8685, 6.924] }),
    createdAt: new Date().toISOString()
  }
];

export const mockSOSSignals: SOSSignal[] = [
  {
    id: "88888888-8888-8888-8888-888888888888",
    senderId: "citizen-demo-2",
    location: JSON.stringify({ type: "Point", coordinates: [79.882, 6.94] }),
    type: "evacuation",
    description: "Family trapped on second floor, rising water level.",
    status: "assigned",
    assignedTo: "ngo-demo-1",
    disasterId: mockDisasters[0].id,
    createdAt: new Date().toISOString()
  }
];

export const mockNews: NewsUpdate[] = [
  {
    id: "99999999-9999-9999-9999-999999999999",
    title: "Road Closures in Colombo 07",
    content:
      "Ward Place and surrounding roads are temporarily closed. Use alternate safe-zone routes shown in the app.",
    category: "transport",
    disasterId: mockDisasters[0].id,
    authorId: "gov-demo-1",
    createdAt: new Date().toISOString()
  }
];

export const mockOrganizations: Organization[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Rapid Relief Lanka",
    type: "ngo",
    description: "Urban flood response specialists",
    approvalStatus: "approved",
    createdAt: new Date().toISOString()
  }
];

export const mockDashboardStats: DashboardStats = {
  activeDisasters: 1,
  pendingSOS: 3,
  totalResources: 12,
  totalSafeZones: 2,
  totalUsers: 1480
};
