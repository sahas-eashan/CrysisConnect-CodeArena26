# Configuration and deployment

## Local development

Run `npm ci --legacy-peer-deps` followed by `npm run dev`. When Cognito is absent, development enables the three explicit demo identities. `.data/hazards.json` stores cases, evidence, weather readings, area alerts, histories, reservations and feedback. Restarting the development server preserves them. This file and browser-test stores are ignored by Git.

For live Gemini checks, copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` on the server and restart. Never use a `NEXT_PUBLIC_` variable for that key. The default model is configurable with `HAZARD_GEMINI_MODEL`. Missing keys, provider failures and incomplete responses leave the report awaiting human verification.

The weather panel and `npm run weather:replay` explicitly mark simulated observations. A normal observation is saved without inventing a hazard. A threshold breach opens a pending case and area warning before AI runs. Same-station, same-time retries are idempotent; conflicting observations are rejected.

`rainfallMm` is accumulated rainfall over the previous hour. The initial 50 mm/hour threshold is a prototype setting, not an official local warning threshold. Replace it with locally approved settings before real operational use.

Local demo roles are `demo-citizen`, `demo-government` and `demo-ngo`. Assign to `demo-ngo` to exercise the crew workflow. Production must use a real responder's authenticated Cognito subject ID.

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
| `HAZARD_STORE_PATH` | Optional local-demo file path |
| `APP_URL` | Public origin when a reverse proxy terminates TLS |

Unset `HAZARD_DEMO_MODE` for a live deployment. Production without `DATABASE_URL` fails closed. Demo mode is intended only for an isolated local demonstration; it deliberately uses shared demonstration identities.

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

The API verifies Cognito ID-token signature, issuer, audience, expiry and token purpose. Government and NGO roles come from authenticated group membership. Client role selectors and the old `cc-role` cookie cannot authorize live operations. POST requests require JSON, enforce origin checks and a per-process request limit.

Citizen snapshots include their own detailed cases and area alerts near the location they share. Confirmed public-map records omit private report text and photos. Crew access follows assignment. The browser polls shared cases every 10 seconds; the existing SOS screen also has sender-specific AppSync updates with polling recovery.

New hazard warnings and closures are in-app broadcasts. The existing government SMS/email composer still requires its configured delivery providers. Weather replay does not send SMS or email. No cloud resources are provisioned by the web build or test commands.

## Routing

Candidates come from OSRM, with alternatives requested. Complete segments and endpoint approaches are screened against recorded exclusion areas; confirmed hazards and current weather warnings block routes. Legacy disaster polygons must also be readable for a configured legacy backend. Incomplete geometry, unavailable providers, changed hazards, insufficient shelter capacity or an origin inside a risk buffer produce no screened route.

The route description identifies the data and limitations. It is a check against recorded hazards, not a guarantee about unreported hazards or road conditions. Public OSRM is used only by default in development; configure a provider for deployed operation.

For Android, configure `CRISIS_HAZARD_API_URL` with the HTTPS origin of this Next.js deployment in the app's private dart-defines file. The app sends its Cognito ID token for a fresh server screen of every candidate route. Missing configuration or a failed/stale screen leaves the route unavailable. See [Android setup](../citizen_android_app/README.md).

## Verification

Dependency maintenance includes the patched Next.js 15 release, MapLibre 6 and Sharp 0.35. The scoped Next.js PostCSS override replaces its older pinned parser; keep it until Next.js supplies a patched version directly. MapLibre's worker and shared module are copied from the installed package by `predev` and `prebuild`, following the [official Next.js integration instructions](https://maplibre.org/maplibre-gl-js/docs/). Map rendering needs WebGL 2; unsupported browsers retain readable case details and alerts.

Unit and service tests use isolated stores and explicit test providers. Browser tests run a separate localhost server and fixture evidence with Gemini and database credentials blank. They exercise the real API and UI instead of mocking successful hazard submissions. They do not send real emergency messages.

If a compatible Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable before `npm run test:e2e`. CI normally installs Playwright's pinned browser.

Live cloud delivery, live model output quality and device GPS require a deployment exercise with the team's configured accounts. The test suite does not claim to validate those external services.
