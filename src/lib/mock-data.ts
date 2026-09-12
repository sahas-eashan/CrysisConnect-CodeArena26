import type {
  AlertDraft,
  AiAuditRef,
  CitizenGuidance,
  DashboardStats,
  Disaster,
  IncidentBrief,
  NewsUpdate,
  OperationsRecommendationSet,
  Organization,
  PreparedSosSubmission,
  Resource,
  ResourceDispatchPlan,
  ResourceRequest,
  SOSSignal,
  SafeZone,
  SosTriage
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

export const mockAiAuditLogs: AiAuditRef[] = [
  {
    id: "ai-audit-1",
    action: "generateIncidentBrief",
    model: "gemini-2.5-pro",
    status: "completed",
    createdAt: new Date().toISOString(),
    reviewStatus: "approved"
  },
  {
    id: "ai-audit-2",
    action: "triageSosCase",
    model: "gemini-2.5-flash",
    status: "completed",
    createdAt: new Date().toISOString(),
    reviewStatus: "pending_review"
  }
];

export const mockIncidentBrief: IncidentBrief = {
  meta: {
    status: "mock",
    confidence: 0.84,
    sourceIds: [mockDisasters[0].id, mockSafeZones[0].id, mockResources[0].id],
    warnings: ["Demo mode fallback: verify details with the live command team."],
    requiresHumanApproval: true,
    audit: mockAiAuditLogs[0],
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  headline: "Flood pressure is rising around central Colombo shelters.",
  summary:
    "AI analysis suggests the current flood is driving shelter occupancy upward while evacuation and medical support remain the highest immediate operational needs.",
  rationale: {
    summary: "The recommendation is grounded in active disaster, shelter, SOS, and resource data.",
    bullets: [
      "Primary disaster severity is high with water contamination risk.",
      "Current shelter occupancy is above one third across both safe zones.",
      "SOS demand and medical resource pressure indicate near-term response strain."
    ]
  },
  recommendations: [
    {
      title: "Pre-stage medical kits",
      detail: "Move medical kits toward the highest SOS density cluster before nightfall.",
      priority: "high"
    },
    {
      title: "Open overflow shelter capacity",
      detail: "Prepare surge capacity near Colombo 07 to reduce shelter saturation risk.",
      priority: "high"
    }
  ],
  translations: {
    english: "Flood pressure is increasing. Prioritize medical staging and overflow shelter preparation.",
    sinhala: "ගංවතුර පීඩනය වැඩි වෙමින් පවතී. වෛද්‍ය පහසුකම් සහ අමතර ආරක්ෂිත නවාතැන් සූදානම් කරන්න.",
    tamil: "வெள்ள அழுத்தம் அதிகரிக்கிறது. மருத்துவ உதவி மற்றும் கூடுதல் பாதுகாப்பு முகாம்களை தயார் செய்யுங்கள்."
  }
};

export const mockAlertDraft: AlertDraft = {
  meta: {
    status: "mock",
    confidence: 0.87,
    sourceIds: [mockDisasters[0].id],
    warnings: ["Human approval required before any public broadcast."],
    requiresHumanApproval: true,
    audit: {
      id: "ai-audit-3",
      action: "generateAlertDraft",
      model: "gemini-2.5-flash",
      status: "completed",
      createdAt: new Date().toISOString(),
      reviewStatus: "pending_review"
    },
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  title: "Colombo Flood Safety Alert",
  channel: ["sms", "push", "email"],
  rationale: {
    summary: "Draft emphasizes movement to safe zones and contaminated water precautions.",
    bullets: [
      "Uses plain public language suitable for fast multi-channel delivery.",
      "Avoids unsupported promises or unverified evacuation claims."
    ]
  },
  english:
    "Flooding is active in Colombo. Move toward the nearest safe zone shown in CrisisConnect and avoid consuming unboiled water.",
  sinhala:
    "කොළඹ ප්‍රදේශයේ ගංවතුර ක්‍රියාත්මකයි. CrisisConnect හි පෙන්වන ආරක්ෂිත ස්ථානය වෙත ගමන් කර තැම්බූ නොවන ජලය පානය කිරීමෙන් වළකින්න.",
  tamil:
    "கொழும்பில் வெள்ள அபாயம் நிலவுகிறது. CrisisConnect இல் காட்டப்படும் பாதுகாப்பு மையத்திற்குச் செல்லவும், காய்ச்சாத தண்ணீரை குடிக்க வேண்டாம்."
};

export const mockOperationsRecommendationSet: OperationsRecommendationSet = {
  meta: {
    status: "mock",
    confidence: 0.81,
    sourceIds: [mockDisasters[0].id, mockSOSSignals[0].id, mockResources[1].id],
    warnings: ["Operational ranking should be confirmed by the duty officer."],
    requiresHumanApproval: true,
    audit: {
      id: "ai-audit-4",
      action: "recommendOperations",
      model: "gemini-2.5-flash",
      status: "completed",
      createdAt: new Date().toISOString(),
      reviewStatus: "pending_review"
    },
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  timeframe: "next_6_hours",
  rationale: {
    summary: "Ranked by active risk, shelter pressure, and responder demand.",
    bullets: [
      "Medical and evacuation needs remain the highest urgency.",
      "Low first-aid inventory may constrain sustained response."
    ]
  },
  recommendations: [
    {
      title: "Dispatch responder pair to high-risk SOS",
      detail: "Prioritize the assigned evacuation SOS before additional rainfall bands arrive.",
      priority: "critical"
    },
    {
      title: "Rebalance first-aid kits",
      detail: "Shift stock from lower-use depots to central flood shelters.",
      priority: "high"
    }
  ]
};

export const mockSosTriage: SosTriage = {
  meta: {
    status: "mock",
    confidence: 0.8,
    sourceIds: [mockSOSSignals[0].id, "ngo-demo-1", "ngo-demo-2"],
    warnings: ["Responder assignment remains a human approval action."],
    requiresHumanApproval: true,
    audit: mockAiAuditLogs[1],
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  sosId: mockSOSSignals[0].id,
  severity: "high",
  urgency: "immediate",
  responderIds: ["ngo-demo-1", "ngo-demo-2"],
  rationale: {
    summary: "The signal indicates trapped people with rising water and requires urgent evacuation support.",
    bullets: [
      "Description indicates a family trapped above floodwater.",
      "Responder proximity and availability make NGO demo profiles suitable."
    ]
  },
  recommendations: [
    {
      title: "Assign flood-capable responder",
      detail: "Dispatch the closest available NGO responder with evacuation support equipment.",
      priority: "critical"
    }
  ]
};

export const mockResourceDispatchPlan: ResourceDispatchPlan = {
  meta: {
    status: "mock",
    confidence: 0.76,
    sourceIds: [mockResourceRequests[0].id, mockResources[0].id],
    warnings: ["Inventory availability should be reconfirmed before dispatch."],
    requiresHumanApproval: true,
    audit: {
      id: "ai-audit-5",
      action: "recommendResourceDispatch",
      model: "gemini-2.5-flash",
      status: "completed",
      createdAt: new Date().toISOString(),
      reviewStatus: "pending_review"
    },
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  requestId: mockResourceRequests[0].id,
  rationale: {
    summary: "Water and food support should be bundled to satisfy the pending request efficiently.",
    bullets: [
      "The request is high urgency and close to available inventory.",
      "Combining essentials reduces duplicate field trips."
    ]
  },
  recommendations: [
    {
      title: "Bundle water with dry food",
      detail: "Send bottled water alongside dry food packs to reduce repeated dispatches.",
      priority: "high"
    }
  ]
};

export const mockCitizenGuidance: CitizenGuidance = {
  meta: {
    status: "mock",
    confidence: 0.82,
    sourceIds: [mockDisasters[0].id, mockSafeZones[0].id, mockResources[0].id],
    warnings: ["Guidance is advisory and should be confirmed with official instructions."],
    requiresHumanApproval: false,
    audit: {
      id: "ai-audit-6",
      action: "getCitizenGuidance",
      model: "gemini-2.5-flash",
      status: "completed",
      createdAt: new Date().toISOString(),
      reviewStatus: "not_required"
    },
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  title: "Safety guidance for your area",
  safeZoneId: mockSafeZones[0].id,
  resourceIds: [mockResources[0].id],
  nextSteps: [
    "Move toward the recommended safe zone before roads flood further.",
    "Avoid consuming unboiled water.",
    "Keep your phone charged for live alerts."
  ],
  guidance: {
    english:
      "Move toward Independence Hall Shelter if it is safe to travel. Avoid flooded roads and use bottled or boiled water only.",
    sinhala:
      "ගමන් කිරීම ආරක්ෂිත නම් Independence Hall Shelter වෙත යන්න. ජලයෙන් වැසුණු මාර්ග වලින් වළකින්න සහ බෝතල් ජලය හෝ තැම්බූ ජලය පමණක් භාවිතා කරන්න.",
    tamil:
      "பாதுகாப்பாக பயணம் செய்ய முடிந்தால் Independence Hall Shelter நோக்கி செல்லுங்கள். வெள்ளமான சாலைகளை தவிர்த்து, பாட்டில் அல்லது காய்ச்சிய தண்ணீரை மட்டுமே பயன்படுத்துங்கள்."
  }
};

export const mockPreparedSosSubmission: PreparedSosSubmission = {
  meta: {
    status: "mock",
    confidence: 0.79,
    sourceIds: [],
    warnings: ["Review before sending. AI cannot verify on-the-ground conditions."],
    requiresHumanApproval: true,
    audit: {
      id: "ai-audit-7",
      action: "prepareSosSubmission",
      model: "gemini-2.5-flash",
      status: "completed",
      createdAt: new Date().toISOString(),
      reviewStatus: "pending_review"
    },
    riskFlags: {
      blocked: false,
      piiDetected: false,
      promptInjectionRisk: false,
      unsafeContent: false,
      reasons: []
    }
  },
  original: "family trapped upstairs water coming in fast need help",
  refined:
    "Evacuation emergency: a family is trapped on an upper floor while floodwater is rising rapidly and immediate rescue support is needed.",
  checklist: [
    "Confirm the emergency type before sending.",
    "Keep location services enabled.",
    "Call local emergency services if immediate danger escalates."
  ],
  translations: {
    english:
      "Evacuation emergency: a family is trapped on an upper floor while floodwater is rising rapidly.",
    sinhala:
      "ඉවත් කිරීමේ හදිසි තත්ත්වයක්: පවුලක් ඉහළ මහලක සිරවී ඇති අතර ජල මට්ටම වේගයෙන් ඉහළ යයි.",
    tamil:
      "வெளியேற்ற அவசரம்: ஒரு குடும்பம் மேல்தளத்தில் சிக்கியுள்ளது, வெள்ளநீர் வேகமாக உயர்கிறது."
  }
};
