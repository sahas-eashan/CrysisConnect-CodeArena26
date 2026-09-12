# Presentation Outline

## Slide 1: Title

- CrisisConnect
- Disaster Management & Community Resilience
- Unified early warning, rescue coordination, and relief platform

## Slide 2: Real Problem

- Communication is fragmented during disasters
- Citizens do not know where to go
- Resource demand and supply are disconnected
- SOS requests are hard to route and track

## Slide 3: Our Solution

- One system for citizens, NGOs, and government
- Real-time alerts, map intelligence, SOS coordination, and resource management
- Built for Sri Lankan disaster conditions and constrained infrastructure

## Slide 4: Innovation

- Geofenced alerting with disaster polygons
- Capacity-aware safe-zone routing
- Geospatial SOS responder matching
- Offline-safe experience
- Full AWS provisioning with Terraform

## Slide 5: Architecture

Use the architecture from `README.md`

- Next.js frontend
- Cognito auth
- AppSync GraphQL + subscriptions
- Lambda business logic
- RDS PostgreSQL + PostGIS
- SNS / SES / S3 / CloudWatch

## Slide 6: Demo Walkthrough

- Government registers disaster
- Citizens receive alerts and view safe zones
- Citizen sends SOS
- NGO accepts dispatch
- Government reviews analytics and finance

## Slide 7: Cloud + Security

- AWS-native backend
- Terraform-managed infrastructure
- Cognito-based RBAC
- Parameterized SQL
- Protected storage and centralized observability

## Slide 8: Business Value

- B2G SaaS potential
- District-level deployment model
- Usable by NGOs and volunteer networks
- Expandable beyond Sri Lanka

## Slide 9: Closing

- Original system aligned to the hackathon domain
- Solves a meaningful real-world gap
- Technically scalable and demo-ready
