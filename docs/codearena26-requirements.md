# Topic 04 implementation map

This maps the Disaster Response brief to code and a reviewable demonstration. It records what runs locally and what needs configured external services.

| Requirement | Implementation | Demonstration / verification |
|---|---|---|
| Citizen hazard/help report with photo and GPS | `src/components/hazards/report-form.tsx`, `src/lib/hazards/service.ts` | Submit from `/citizen/hazards`; photos, location, assistance request and history persist. |
| Independent weather/river feed | `scripts/replay-weather.mjs`, `submitWeather` | Normal readings persist; flood thresholds create a pending case and nearby area warning before model calls. Identical retries do not duplicate events. |
| Plain-code weather check | `src/lib/hazards/engine.ts` | Recent station readings within 10 km are compared with rainfall/river thresholds. Missing/stale data is explicit. |
| Plain-code cluster check | `src/lib/hazards/engine.ts` | Distinct reporters within 200 m and two hours provide corroboration; repeated reports from one account do not count as independent evidence. |
| Image, location and risk AI checks | `src/lib/hazards/ai.ts` | Backend Gemini calls inspect supplied evidence. Location receives the image and claimed coordinates but cannot invent verified geographic provenance. |
| Aggregator with reasons and confidence | `src/lib/hazards/ai.ts`, `engine.ts` | All five results are passed to the aggregator. Evidence gates require review when checks fail or disagree. Model estimates are marked uncalibrated; unavailable confidence stays null. |
| More-information loop | `requestEvidence`, `addEvidence` | Officer requests evidence, citizen adds a photo, backend reevaluates and retains history. |
| Confirmed map + affected-area alert | `reviewCase`, `snapshot`, `hazard-map.tsx` | Confirmation publishes the hazard and a persisted area alert. Citizens receive nearby alerts after sharing GPS, plus updates on their own cases. |
| Routes around known hazards | `routing.ts`, `polygon-safety.ts` | Candidate road segments are screened against hazard buffers, current weather warnings and configured legacy disaster polygons; unsafe/unavailable candidates are rejected. |
| Crew assignment and photographic closure | `assignCase`, `closeCase` | Government dispatches; the assigned crew submits a distinct clearance photo and notes. The active map removes the hazard and citizens receive the closure update. |
| Relief desk | `assignRelief`, `releaseRelief` | Assign resources/organization and reserve shelter places atomically. Shelter capacity is released explicitly when people depart, not automatically when a road is cleared. |
| Human feedback | `reviewCase`, `updateThresholds` | Review outcomes persist and adjust a bounded operational confirmation threshold. This is an operational feedback loop, not a claim that model weights were retrained. |

## Reviewed regressions fixed

- Web citizen map uses actual AppSync records and current hazard state; it no longer contains the fixed demo flood or selects an unrelated shelter when an ID is missing.
- Web SOS updates include sender-filtered subscriptions and polling recovery; producer selection sets contain the fields subscribers need.
- Android SOS requires a confirmed server record and retains an unconfirmed request for retry after errors.
- Android driving routes are screened against current full disaster polygons, including segment crossings and endpoint approaches, and require a fresh server check against the shared hazard workflow.
- All legacy AI confidence fields are nullable model estimates with provenance. Mock fixtures do not claim live model confidence.
- Authenticated GPS persistence supports geofenced recipients and responder matching. Disaster status updates now accept validated government transitions.
- Live portal/API roles derive from verified Cognito tokens; a submitted role or legacy cookie is insufficient.

## Operating scope

The complete hazard workflow is available in the responsive web portals. The existing Flutter app receives the SOS/routing/confidence/location fixes; it does not yet contain the new web hazard-report/review API screens. Use the citizen web portal for the photo-to-clearance CodeArena demonstration.

New area alerts are in-app broadcasts. The original government's SMS/email composer remains available with its cloud providers. Test data and replay readings are explicitly labeled, and automated tests do not send real messages or impersonate live AI results.

Live Gemini quality, physical-device GPS and cloud delivery need a separate configured deployment exercise. Local and CI checks cover domain behavior, API errors/roles, browser handoffs, compilation and Android analysis/tests.
