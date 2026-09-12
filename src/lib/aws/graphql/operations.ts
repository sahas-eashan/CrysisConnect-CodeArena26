export const queries = {
  getDisasters: /* GraphQL */ `
    query GetDisasters($status: String) {
      getDisasters(status: $status) {
        id
        title
        description
        type
        severity
        status
        affectedArea
        centerPoint
        radiusKm
        secondaryRisks
        createdAt
      }
    }
  `,
  getSafeZones: /* GraphQL */ `
    query GetSafeZones($disasterId: ID) {
      getSafeZones(disasterId: $disasterId) {
        id
        name
        location
        capacity
        currentOccupancy
        amenities
        disasterId
        status
      }
    }
  `,
  getResources: /* GraphQL */ `
    query GetResources($disasterId: ID, $category: String) {
      getResources(disasterId: $disasterId, category: $category) {
        id
        name
        category
        quantity
        unit
        status
        location
        managedBy
        orgId
        disasterId
      }
    }
  `,
  getResourceRequests: /* GraphQL */ `
    query GetResourceRequests($status: String) {
      getResourceRequests(status: $status) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        createdAt
        location
      }
    }
  `,
  getMyResourceRequests: /* GraphQL */ `
    query GetMyResourceRequests($status: String) {
      getMyResourceRequests(status: $status) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        createdAt
        location
      }
    }
  `,
  getSOSSignals: /* GraphQL */ `
    query GetSOSSignals($status: String) {
      getSOSSignals(status: $status) {
        id
        senderId
        location
        type
        description
        status
        assignedTo
        disasterId
        createdAt
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  `,
  getMySOSSignals: /* GraphQL */ `
    query GetMySOSSignals($status: String) {
      getMySOSSignals(status: $status) {
        id
        senderId
        location
        type
        description
        status
        assignedTo
        disasterId
        createdAt
        resolvedAt
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  `,
  getAlerts: /* GraphQL */ `
    query GetAlerts($disasterId: ID) {
      getAlerts(disasterId: $disasterId) {
        id
        title
        body
        type
        channel
        targetArea
        targetRoles
        disasterId
        createdBy
        createdAt
      }
    }
  `,
  getNewsUpdates: /* GraphQL */ `
    query GetNewsUpdates($disasterId: ID) {
      getNewsUpdates(disasterId: $disasterId) {
        id
        title
        content
        category
        disasterId
        authorId
        createdAt
      }
    }
  `,
  getOrganizations: /* GraphQL */ `
    query GetOrganizations($status: String) {
      getOrganizations(status: $status) {
        id
        name
        type
        description
        approvalStatus
        createdAt
      }
    }
  `,
  getDashboardStats: /* GraphQL */ `
    query GetDashboardStats {
      getDashboardStats {
        activeDisasters
        pendingSOS
        totalResources
        totalSafeZones
        totalUsers
      }
    }
  `,
  getCitizenGuidance: /* GraphQL */ `
    query GetCitizenGuidance($disasterId: ID) {
      getCitizenGuidance(disasterId: $disasterId) {
        title
        safeZoneId
        resourceIds
        nextSteps
        guidance {
          english
          sinhala
          tamil
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  getAiAuditLogs: /* GraphQL */ `
    query GetAiAuditLogs($limit: Int) {
      getAiAuditLogs(limit: $limit) {
        id
        action
        model
        status
        createdAt
        reviewStatus
      }
    }
  `,
  getNearestSafeZone: /* GraphQL */ `
    query GetNearestSafeZone($lat: Float!, $lon: Float!) {
      getNearestSafeZone(lat: $lat, lon: $lon) {
        id
        name
        location
        capacity
        currentOccupancy
        status
      }
    }
  `
};

export const mutations = {
  createDisaster: /* GraphQL */ `
    mutation CreateDisaster($input: DisasterInput!) {
      createDisaster(input: $input) {
        id
        title
        severity
        type
        status
        affectedArea
      }
    }
  `,
  createSafeZone: /* GraphQL */ `
    mutation CreateSafeZone($input: SafeZoneInput!) {
      createSafeZone(input: $input) {
        id
        name
        capacity
        currentOccupancy
        location
      }
    }
  `,
  updateSafeZoneOccupancy: /* GraphQL */ `
    mutation UpdateSafeZoneOccupancy($id: ID!, $delta: Int!) {
      updateSafeZoneOccupancy(id: $id, delta: $delta) {
        id
        name
        capacity
        currentOccupancy
        location
        status
      }
    }
  `,
  createResource: /* GraphQL */ `
    mutation CreateResource($input: ResourceInput!) {
      createResource(input: $input) {
        id
        name
        category
        quantity
        status
      }
    }
  `,
  requestResource: /* GraphQL */ `
    mutation RequestResource($input: ResourceRequestInput!) {
      requestResource(input: $input) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        createdAt
        location
      }
    }
  `,
  fulfillResourceRequest: /* GraphQL */ `
    mutation FulfillResourceRequest($id: ID!) {
      fulfillResourceRequest(id: $id) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        createdAt
        location
      }
    }
  `,
  createSOS: /* GraphQL */ `
    mutation CreateSOS($input: SOSInput!) {
      createSOS(input: $input) {
        id
        type
        status
        description
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  `,
  acceptSOS: /* GraphQL */ `
    mutation AcceptSOS($id: ID!) {
      acceptSOS(id: $id) {
        id
        status
        assignedTo
      }
    }
  `,
  resolveSOS: /* GraphQL */ `
    mutation ResolveSOS($id: ID!) {
      resolveSOS(id: $id) {
        id
        status
        assignedTo
        resolvedAt
      }
    }
  `,
  createNewsUpdate: /* GraphQL */ `
    mutation CreateNewsUpdate($input: NewsInput!) {
      createNewsUpdate(input: $input) {
        id
        title
        content
        category
      }
    }
  `,
  sendAlert: /* GraphQL */ `
    mutation SendAlert($input: AlertInput!) {
      sendAlert(input: $input) {
        sent
        channel
      }
    }
  `,
  registerOrganization: /* GraphQL */ `
    mutation RegisterOrganization($input: OrgInput!) {
      registerOrganization(input: $input) {
        id
        name
        approvalStatus
      }
    }
  `,
  approveOrganization: /* GraphQL */ `
    mutation ApproveOrganization($id: ID!, $approved: Boolean!) {
      approveOrganization(id: $id, approved: $approved) {
        id
        name
        approvalStatus
      }
    }
  `,
  generateIncidentBrief: /* GraphQL */ `
    mutation GenerateIncidentBrief($disasterId: ID) {
      generateIncidentBrief(disasterId: $disasterId) {
        headline
        summary
        translations {
          english
          sinhala
          tamil
        }
        rationale {
          summary
          bullets
        }
        recommendations {
          title
          detail
          priority
          relatedIds
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  generateAlertDraft: /* GraphQL */ `
    mutation GenerateAlertDraft($input: AiAlertDraftInput!) {
      generateAlertDraft(input: $input) {
        title
        channel
        english
        sinhala
        tamil
        rationale {
          summary
          bullets
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  recommendOperations: /* GraphQL */ `
    mutation RecommendOperations($timeframe: String) {
      recommendOperations(timeframe: $timeframe) {
        timeframe
        rationale {
          summary
          bullets
        }
        recommendations {
          title
          detail
          priority
          relatedIds
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  triageSosCase: /* GraphQL */ `
    mutation TriageSosCase($id: ID!) {
      triageSosCase(id: $id) {
        sosId
        severity
        urgency
        responderIds
        rationale {
          summary
          bullets
        }
        recommendations {
          title
          detail
          priority
          relatedIds
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  recommendResourceDispatch: /* GraphQL */ `
    mutation RecommendResourceDispatch($id: ID!) {
      recommendResourceDispatch(id: $id) {
        requestId
        rationale {
          summary
          bullets
        }
        recommendations {
          title
          detail
          priority
          relatedIds
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  prepareSosSubmission: /* GraphQL */ `
    mutation PrepareSosSubmission($input: AiPrepareSosInput!) {
      prepareSosSubmission(input: $input) {
        original
        refined
        checklist
        translations {
          english
          sinhala
          tamil
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
          riskFlags {
            blocked
            piiDetected
            promptInjectionRisk
            unsafeContent
            reasons
          }
        }
      }
    }
  `,
  reviewAiAuditLog: /* GraphQL */ `
    mutation ReviewAiAuditLog($id: ID!, $approved: Boolean!) {
      reviewAiAuditLog(id: $id, approved: $approved) {
        id
        action
        model
        status
        createdAt
        reviewStatus
      }
    }
  `
};

export const subscriptions = {
  onNewDisaster: /* GraphQL */ `
    subscription OnNewDisaster {
      onNewDisaster {
        id
        title
        severity
        status
      }
    }
  `,
  onNewSOS: /* GraphQL */ `
    subscription OnNewSOS {
      onNewSOS {
        id
        type
        status
        description
      }
    }
  `,
  onSOSUpdate: /* GraphQL */ `
    subscription OnSOSUpdate {
      onSOSUpdate {
        id
        status
        assignedTo
        resolvedAt
      }
    }
  `,
  onMySOSUpdate: /* GraphQL */ `
    subscription OnMySOSUpdate($senderId: String!) {
      onMySOSUpdate(senderId: $senderId) {
        id
        senderId
        status
        assignedTo
        resolvedAt
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  `,
  onResourceUpdate: /* GraphQL */ `
    subscription OnResourceUpdate {
      onResourceUpdate {
        id
        name
        quantity
        status
      }
    }
  `,
  onNewResourceRequest: /* GraphQL */ `
    subscription OnNewResourceRequest {
      onNewResourceRequest {
        id
        resourceName
        quantityNeeded
        urgency
        status
      }
    }
  `,
  onMyResourceRequestUpdate: /* GraphQL */ `
    subscription OnMyResourceRequestUpdate($requestedBy: String!) {
      onMyResourceRequestUpdate(requestedBy: $requestedBy) {
        id
        requestedBy
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        createdAt
      }
    }
  `,
  onNewNews: /* GraphQL */ `
    subscription OnNewNews {
      onNewNews {
        id
        title
        content
        category
      }
    }
  `,
  onAlert: /* GraphQL */ `
    subscription OnAlert {
      onAlert {
        sent
        channel
      }
    }
  `
};
