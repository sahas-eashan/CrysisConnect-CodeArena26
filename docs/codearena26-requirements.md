# Topic 04 implementation map

This maps the Disaster Response brief to code and a reviewable demonstration. It records what runs locally and what needs configured external services.

| Requirement | Implementation | Demonstration / verification |
|---|---|---|
| Citizen hazard/help report with photo and GPS | `src/components/hazards/report-form.tsx`, `src/lib/hazards/service.ts` | Submit from `/citizen/hazards`; photos, location, assistance request and history persist. |
| Roads, wards and responsible council | `geography.ts`, `geography.demo.json`, `assignCouncil` | Server-side polygon lookup identifies a ward/council and nearest configured road, opens a council ticket and supports scoped queues and reassignment. Three synthetic wards demonstrate multiple councils. Live operation requires verified geometry. |
| Independent weather/river feed | `scripts/replay-weather.mjs`, `submitWeather` | Normal readings persist; flood thresholds create a pending case and nearby area warning before model calls. Identical retries do not duplicate events. |
| Plain-code weather check | `src/lib/hazards/engine.ts` | Recent station readings within 10 km are compared with rainfall/river thresholds. Missing/stale data is explicit. |
| Plain-code cluster check | `src/lib/hazards/engine.ts` | Distinct reporters and invited nearby photo observations within 200 m and two hours provide corroboration. Repeat accounts and banned reporters do not inflate support. |
| Image, location and risk AI checks | `src/lib/hazards/ai.ts`, `photo-metadata.ts` | Server-decoded EXIF GPS, capture time and camera metadata accompany images, claimed GPS and geography. GPS disagreements require human review. Missing metadata is explicit; editable EXIF is not authenticated provenance. |
| Aggregator with reasons, confidence and urgency | `src/lib/hazards/ai.ts`, `engine.ts` | All five results feed a structured aggregator with low/moderate/high/critical/unknown urgency. Officers can set urgency, and queues sort by it. Incomplete or conflicting evidence requires review; unavailable confidence stays null. |
| More-information loop | `requestEvidence`, `addEvidence` | Officer requests evidence, citizen adds a photo, backend reevaluates and retains history. |
| Nearby-user confirmation | `community.ts`, `community-panel.tsx` | Officers invite opted-in residents within 200 m. Recipients submit a distinct photo, current GPS and a supporting/contradicting observation. Invitations expire after 30 minutes; original reporters cannot self-confirm. |
| Confirmed map + affected-area alert | `reviewCase`, `snapshot`, `hazard-map.tsx` | Confirmation publishes a persisted area alert. Nearby opted-in residents receive route guidance automatically, and reporters receive their case updates. |
| Alerts with routes around known hazards | `alert-routing.ts`, `routing.ts`, `polygon-safety.ts` | Alert responses include full-segment screening against hazards, weather warnings and AppSync disaster polygons. No separate route request is necessary. Missing GPS, provider failure, changed hazards or an unsafe origin yields explicit unavailable guidance. |
| Crew assignment and photographic closure | `assignCase`, `closeCase` | Government dispatches; the assigned crew submits a distinct clearance photo and notes. The active map removes the hazard and citizens receive the closure update. |
| Dedicated relief coordinator | `/relief/hazards`, `auto-relief.ts`, `assignRelief`, `releaseRelief` | A verified relief role manages assistance, automatically chooses the nearest eligible shelter with capacity, or records a manual assignment. Reservations are atomic. Origins inside hazard buffers require crew-assisted extraction; no route is invented. Departures release capacity explicitly. |
| False-reporter banning | `banReporter`, `unbanReporter`, `moderation-panel.tsx` | Government must reference a human-rejected report and record a reason. Active bans block hazard reports and evidence uploads; reversal retains the audit trail. Public safety information remains accessible. |
| Public live map without login | `/public-map`, `/api/hazards/public` | A periodically refreshed, read-only map exposes generic hazards, warnings and shelters. The endpoint omits private cases, evidence, resident positions, recipient routes and moderation data. |
| Human feedback | `reviewCase`, `updateThresholds` | Review outcomes persist and adjust a bounded operational confirmation threshold. This is an operational feedback loop, not a claim that model weights were retrained. |

## Supporting platform features

- The citizen map displays AppSync records and current hazard state. Shelter details use the selected shelter's ID.
- Web SOS updates include sender-filtered subscriptions and polling recovery; producer selection sets contain the fields subscribers need.
- Android SOS requires a confirmed server record and retains an unconfirmed request for retry after errors.
- Android driving routes are screened against current full disaster polygons, including segment crossings and endpoint approaches, and require a fresh server check against the shared hazard workflow.
- AI confidence fields are nullable model estimates with their source identified. Mock fixtures do not claim live model confidence.
- Authenticated GPS persistence supports geofenced recipients and responder matching. Disaster status updates validate government transitions.
- Live portal/API roles derive from verified Cognito tokens; client role selectors and cookies cannot authorize operations.

## Operating scope

The complete hazard workflow is available in the responsive web portals. The Flutter app supports SOS, resources, location sharing and screened routing; hazard-report and officer-review screens are available through the web portals. Use the citizen web portal for the photo-to-clearance demonstration.

Area alerts are in-app broadcasts. The government SMS/email composer requires configured cloud providers. Test data and replay readings are explicitly labeled, and automated tests do not send real messages or impersonate live AI results.

Live Gemini quality, physical-device GPS, verified roads/administrative boundaries and cloud delivery require configured deployment validation. `npm run verify:live` inventories configuration; `npm run verify:live -- --live` exercises the real adapters with synthetic inputs and read-only cloud checks. See [live validation](live-validation.md) for the exact scope. Local and CI tests use controlled providers and do not establish operational readiness.
