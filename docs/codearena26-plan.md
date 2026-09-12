# CodeArena 26 workflow scope

## Scope

Implement the Disaster Response brief in CodeArena26_Ideathon_Topics_v2.pdf:

1. Citizen hazard/help reports with photos and GPS, persistent case status, and requests for additional evidence.
2. A replayable weather/river feed that raises area warnings independently of citizen reports.
3. Plain-code weather and nearby-report checks, backend image/location/risk AI checks, and a reasoned aggregate verdict. Missing AI credentials must never produce invented verification or confidence.
4. Confirmed hazards on a shared map, geographically scoped in-app alerts, and routes screened against known hazards.
5. Officer review, crew assignment, photographic closure, relief coordination, and recorded feedback that adjusts future review thresholds.

## Delivery

Preserve existing AWS/AppSync functionality. Add a backend hazard workflow shared by the citizen, government, and NGO portals. Use durable local storage for an explicit local demo and PostgreSQL for deployed operation. Keep model calls and secrets on the server, verify authenticated roles for live actions, and provide a deterministic weather replay and meaningful automated tests.

Cloud provisioning, real emergency messages, and a public deployment are outside this repository implementation task.
