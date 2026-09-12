# CrisisConnect Demo Script

## Demo Goal

Show a complete disaster-response lifecycle in under 10 minutes with clear role handoffs between government, citizens, and NGO responders.

## Scenario

**Colombo flood emergency**

- Heavy rainfall causes rapid flooding in a dense urban zone.
- Government command center registers the disaster.
- Nearby citizens are warned and directed to shelters.
- A trapped family submits an SOS.
- An NGO responder accepts the dispatch.
- Resource and finance dashboards reflect the response.

## Step-by-Step Demo

### 1. Start on the landing page

- Introduce CrisisConnect as an all-in-one disaster coordination platform.
- Mention the three portals and the AWS + Terraform architecture.

### 2. Government portal

Open `/admin/disasters`

- Draw the disaster polygon on the map.
- Enter title, type, severity, and secondary risks.
- Explain that this flows to AppSync -> Lambda -> RDS PostGIS.
- Mention that the async worker triggers SMS and email alerts.

Then open `/admin/alerts`

- Show the multi-channel alert composer.
- Explain SNS for SMS, SES for email, and AppSync subscriptions for live client updates.

### 3. Citizen portal

Open `/citizen/map`

- Show the new disaster zone, safe zones, and resources on the map.
- Explain capacity-aware routing.

Open `/citizen/sos`

- Trigger location capture.
- Submit an SOS for evacuation.
- Explain that the backend finds the nearest available responders with geospatial matching.

### 4. NGO portal

Open `/ngo/sos-queue`

- Show the incoming SOS queue.
- Accept the dispatch.
- Explain that this mutation updates status and notifies the citizen in real time.

Open `/ngo/resources`

- Show resource inventory and how field workers publish stock changes.

### 5. Government analytics and finance

Open `/admin/analytics` and `/admin/finance`

- Show that the platform is not just a notification tool.
- Emphasize that command teams also get operational visibility, aid allocation, and measurable response data.

## Key Talking Points

- One platform, three user groups, shared operational picture.
- Geospatial intelligence via PostGIS.
- Real-time coordination via AppSync subscriptions.
- AWS-native cloud architecture provisioned using Terraform.
- Offline-ready UX for degraded connectivity.

## Backup Plan

If live AWS services are not configured:

- Use the built-in demo mode on the frontend.
- Explain that the infrastructure has already been validated with Terraform plan/validate.
- Show the Terraform files and the successful plan summary from the terminal.
