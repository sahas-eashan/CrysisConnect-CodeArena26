# Configuration and deployment

## Local development

Run `npm ci --legacy-peer-deps` followed by `npm run dev`. When Cognito is absent, development enables explicit citizen, government, NGO and relief demo roles. `.data/hazards.json` stores cases, evidence, weather readings, area alerts, histories, reservations, opt-in locations, community invitations, reporting bans and feedback. Restarting the development server preserves them. This file and browser-test stores are ignored by Git. Existing version-1 stores acquire the new optional collections without replacing cases or shelter reservations.

For live Gemini checks, copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` on the server and restart. Never use a `NEXT_PUBLIC_` variable for that key. The default model is configurable with `HAZARD_GEMINI_MODEL`. Missing keys, provider failures and incomplete responses leave the report awaiting human verification.

The weather panel and `npm run weather:replay` explicitly mark simulated observations. A normal observation is saved without inventing a hazard. A threshold breach opens a pending case and area warning before AI runs. Same-station, same-time retries are idempotent; conflicting observations are rejected.

`rainfallMm` is accumulated rainfall over the previous hour. The initial 50 mm/hour threshold is a prototype setting, not an official local warning threshold. Replace it with locally approved settings before real operational use.

Local demo identities are `demo-citizen`, `demo-government`, `demo-ngo` and `demo-relief`. The citizen selector adds `demo-neighbor` and `demo-neighbor2` for independent observations. Assign to `demo-ngo` to exercise the crew workflow. Live mode with demo disabled uses authenticated Cognito subject IDs; demo identity headers have no authority there. Explicit demo mode can still accept shared identities in a production build when Cognito is absent.

## Live Node server

The hazard API is a Next.js Node route and cannot run in a static export. It uses the existing Cognito user pool and a server-side PostgreSQL connection. Keep the original Terraform/AppSync deployment for legacy portals and the Android app.

| Environment variable | Purpose |
|---|---|
| `NEXT_PUBLIC_AWS_REGION` | Existing Cognito/AppSync region |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Existing pool; enables verified authentication |
| `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Expected ID-token audience |
| `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` | Existing platform's GraphQL endpoint |
| `DATABASE_URL` | Server-only PostgreSQL connection string, with TLS configured for the deployment |
| `GEMINI_API_KEY` | Server-only Gemini credential |
| `HAZARD_GEMINI_MODEL` | Supported Gemini model chosen for multimodal checks |
| `OSRM_BASE_URL` | Routing provider; required for production routing |
| `HAZARD_SHELTERS_JSON` | Initial verified shelter inventory; see below |
| `HAZARD_GEOGRAPHY_FILE` | Server path to verified ward/council/road GeoJSON, up to 10 MiB |
| `HAZARD_GEOGRAPHY_JSON` | Same geography as inline JSON; takes precedence over the file |
| `HAZARD_STORE_PATH` | Optional local-demo file path |
| `APP_URL` | Public origin when a reverse proxy terminates TLS |

Unset `HAZARD_DEMO_MODE` for a live deployment. Production without `DATABASE_URL` fails closed unless explicit demo mode is enabled. Demo mode is intended only for an isolated local demonstration; it deliberately uses shared demonstration identities.

Run the new migration against the database before starting the live server:

```sh
npm run db:hazards
```

This command reads `.env.local` if present and applies `db/migrations/002_hazards.sql` using `DATABASE_URL`. It does not seed, replace or delete existing application records. The existing Terraform bootstrap also includes this migration.

Provision verified shelters **before the first hazard write**, for example through a server environment secret containing a JSON array:

```json
[{"id":"your-shelter-id","name":"Verified local shelter","location":{"latitude":6.96,"longitude":79.90},"capacity":100,"available":80,"fixture":false}]
```

Those values are illustrative; replace them with confirmed operational data. Environment initialization never overwrites an existing state record. Hazard shelter reservations are a dedicated ledger; do not allocate the same unreserved capacity independently through the legacy safe-zone dashboard. Reconcile that ledger before enabling both workflows for real dispatch.

The JSONB state format is versioned and uses row locks for atomic writes across server replicas. It suits the regional prototype and its bounded datasets. Photos are limited to 2 MiB and stored with case evidence. Plan separate object storage and indexed case tables before scaling to large public traffic. Local JSON storage is for one server process only.

## Authentication and notifications

The API verifies Cognito ID-token signature, issuer, audience, expiry and token purpose. Government, NGO and relief roles come from authenticated group membership. Use the `relief` or `relief_coordinator` group for the dedicated coordinator portal; Terraform includes the `relief` group. Client role selectors and the old `cc-role` cookie cannot authorize live operations. POST requests require JSON, enforce origin checks and a per-process request limit.

Add groups named `council:<ID>` to government and relief accounts to restrict them to those council tickets. IDs must use 1–80 letters, digits, underscores or hyphens and match the configured geography. A government or relief account without council groups has cross-council access; reserve those accounts for regional administrators. A scoped officer cannot transfer a case outside their assigned councils. A regional government administrator can resolve unassigned cases and cross-council transfers.

Citizen snapshots include their own detailed cases and area alerts near the location they share. `/public-map` and its rate-limited `/api/hazards/public` endpoint work without login and expose only generic hazards, warnings and shelters. They omit private report text, evidence, resident profiles, recipient routes and moderation records. Crew access follows assignment; relief views omit photos and AI check records. The browser polls shared cases every 10 seconds; the existing SOS screen also has sender-specific AppSync updates with polling recovery.

Location sharing opts a citizen into nearby alerts and community invitations. Stored positions expire for matching after 24 hours. The stop-sharing action removes the position, personalized deliveries and invitations. Officers can invite eligible residents within 200 m to pending cases; invitations expire after 30 minutes. Confirmation requires current nearby GPS, a distinct photo and a supporting or contradicting observation. Responses belong to the recipient, and an original reporter cannot confirm their own case. Disagreement requires human review.

Government can impose a reporting ban only against a citizen report they have rejected through human review. A reason and case reference are recorded; bans can be lifted with another reason. Active bans block new hazard reports and evidence, and excluded accounts cannot inflate corroboration. Existing reports and the moderation audit remain available. The ban does not disable public hazard information or the separate SOS service.

New hazard warnings and closures are in-app broadcasts. The existing government SMS/email composer still requires its configured delivery providers. Weather replay does not send SMS or email. No cloud resources are provisioned by the web build or test commands.

## Routing

Nearby warning and confirmation alerts include route guidance automatically using a fresh shared position. The response recomputes screening against current state; the UI expires route geometry after 30 seconds and hides it when refresh fails. A resident does not need to submit a separate route-planning request.

Candidates come from OSRM, with alternatives requested. Complete segments and endpoint approaches are screened against recorded exclusion areas; confirmed hazards and current weather warnings block routes. Legacy disaster polygons must also be readable for a configured legacy backend. Incomplete geometry, unavailable providers, changed hazards, insufficient shelter capacity or an origin inside a risk buffer produce no screened route.

The relief coordinator can automatically reserve the nearest geographically eligible shelter with enough capacity and a screened route. The service checks capacity and hazards again before committing. If the household starts inside a hazard, it can reserve the nearest eligible shelter outside exclusions while recording that crew-assisted extraction is required, with no route geometry. Shelter reservations remain until an explicit departure release, even after a hazard is cleared. Manual allocation remains available to record a coordinator's decision.

The route description identifies the data and limitations. It is a check against recorded hazards, not a guarantee about unreported hazards or road conditions. Public OSRM is used only by default in development; configure a provider for deployed operation.

For Android, configure `CRISIS_HAZARD_API_URL` with the HTTPS origin of this Next.js deployment in the app's private dart-defines file. The app sends its Cognito ID token for a fresh server screen of every candidate route. Missing configuration or a failed/stale screen leaves the route unavailable. See [Android setup](../citizen_android_app/README.md).

## Verification

Dependency maintenance includes the patched Next.js 15 release, MapLibre 6 and Sharp 0.35. The scoped Next.js PostCSS override replaces its older pinned parser; keep it until Next.js supplies a patched version directly. MapLibre's worker and shared module are copied from the installed package by `predev` and `prebuild`, following the [official Next.js integration instructions](https://maplibre.org/maplibre-gl-js/docs/). Map rendering needs WebGL 2; unsupported browsers retain readable case details and alerts.

Unit and service tests use isolated stores and explicit test providers. Browser tests run a separate localhost server and fixture evidence with Gemini and database credentials blank. They exercise the real API and UI instead of mocking successful hazard submissions. They do not send real emergency messages.

If a compatible Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable before `npm run test:e2e`. CI normally installs Playwright's pinned browser.

Run `npm run verify:live` for a configuration inventory without network calls, then `npm run verify:live -- --live` after configuring credentials for actual adapter and read-only cloud probes. See [live validation](live-validation.md). Live cloud delivery, model output quality and device GPS require a deployment exercise with the team's configured accounts.

## Geography and photo verification

Local demo storage uses `src/lib/hazards/geography.demo.json`: three fictional wards, two councils and two roads near the demonstration coordinates. It is explicitly synthetic and is never the fallback for missing or invalid live geography.

Supply a GeoJSON `FeatureCollection` through `HAZARD_GEOGRAPHY_FILE` or `HAZARD_GEOGRAPHY_JSON`. Top-level fields are `source` (a descriptive attribution), `verified: true`, `fixture: false`, and optional `roadMatchMaxDistanceM` (default 500). Ward features use `Polygon` or `MultiPolygon` with properties `kind: "ward"`, `id`, `name`, `councilId`, `councilName`. Road features use `LineString` or `MultiLineString` with properties `kind: "road"`, `id`, `name`. Coordinates use longitude, latitude. A verification flag records the operator's assertion; the application cannot certify the underlying dataset.

The server resolves the ward and council, finds the closest road segment within the configured distance and creates a council ticket. Road proximity alone is not proof of the incident's exact road. Boundary ties, uncovered points or invalid configuration remain explicit and block automatic confirmation until human review. Geography is retained with the case as the assignment record. Use council reassignment when an officer resolves ownership; changing the configuration does not silently reassign historical cases.

The server decodes photo bytes and extracts EXIF GPS, capture time and camera information. A GPS distance over 150 m conflicts with the reported position and prevents automatic confirmation. Clearance photos with mismatching GPS are rejected. Missing GPS, unreadable metadata and timestamps without a time-zone offset are shown explicitly. Metadata can be edited, so the AI and officer receive it as evidence rather than verified proof of authenticity. Urgency is structured as `low`, `moderate`, `high`, `critical` or `unknown`; incomplete AI leaves it unknown until a reviewer supplies a level.
