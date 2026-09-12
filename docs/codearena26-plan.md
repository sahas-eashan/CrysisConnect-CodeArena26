# CodeArena 26 workflow and architecture

This project targets the CodeArena 26 Disaster Response topic through citizen reports, evidence verification, area warnings, crew dispatch and relief coordination.

## Response workflow

The application supports the Disaster Response brief through:

1. Citizen hazard/help reports with photos and GPS, persistent case status, and requests for additional evidence.
2. A replayable weather/river feed that raises area warnings independently of citizen reports.
3. Plain-code weather and nearby-report checks, backend image/location/risk AI checks, and a reasoned aggregate verdict. Missing AI credentials must never produce invented verification or confidence.
4. Confirmed hazards on an anonymous public map, geographically scoped in-app alerts with automatic screened routes, and current shelter availability.
5. Automatic road/ward lookup and council tickets, structured urgency, server-side photo metadata checks and nearby-user photo confirmation.
6. Officer review, reporting bans with audited reversal, crew assignment, photographic closure, a dedicated relief portal with automatic shelter allocation, and recorded feedback that adjusts future review thresholds.

The Flutter citizen app supports authenticated resource requests, SOS, location sharing and screened routing. The photo-to-clearance hazard workflow is available through the responsive web portals.

## Architecture

Citizen, government, NGO and relief portals share a Next.js hazard API. It stores demonstration state in a durable local file and deployed state in PostgreSQL. AWS AppSync serves resource, SOS, news and disaster-boundary data for the web and Android clients. Cognito verifies roles and council scopes; model calls and credentials remain on the server.

Local demonstrations use explicitly synthetic geography, shelters and replayed weather observations. Unit and browser tests exercise the workflow with controlled providers. Live model quality, cloud delivery, device GPS and authoritative geographic data require deployment validation. See the [setup guide](codearena26-setup.md), [requirement map](codearena26-requirements.md) and [live validation guide](live-validation.md).
