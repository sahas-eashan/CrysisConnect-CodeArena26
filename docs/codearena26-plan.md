# CodeArena 26 implementation plan

This project targets the CodeArena 26 Disaster Response topic through citizen reports, evidence verification, area warnings, crew dispatch and relief coordination.

## Scope

Implement the Disaster Response brief in CodeArena26_Ideathon_Topics_v2.pdf:

1. Citizen hazard/help reports with photos and GPS, persistent case status, and requests for additional evidence.
2. A replayable weather/river feed that raises area warnings independently of citizen reports.
3. Plain-code weather and nearby-report checks, backend image/location/risk AI checks, and a reasoned aggregate verdict. Missing AI credentials must never produce invented verification or confidence.
4. Confirmed hazards on an anonymous public map, geographically scoped in-app alerts with automatic screened routes, and current shelter availability.
5. Automatic road/ward lookup and council tickets, structured urgency, server-side photo metadata checks and nearby-user photo confirmation.
6. Officer review, false-reporter bans with appeal reversal, crew assignment, photographic closure, a dedicated relief portal with automatic shelter allocation, and recorded feedback that adjusts future review thresholds.

## Delivery

Preserve existing AWS/AppSync functionality. Share the backend hazard workflow across citizen, government, NGO and relief portals. Use durable local storage for an explicit local demo and PostgreSQL for deployed operation. Keep model calls and secrets on the server, verify authenticated roles and council scopes for live actions, and provide synthetic geography, deterministic weather replay and meaningful automated tests.

Cloud provisioning, real emergency messages, and a public deployment are outside this repository implementation task.
