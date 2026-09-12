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
