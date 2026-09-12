# Live service validation

The automated tests use controlled transports and local storage. A passing test run does not establish that a deployed Cognito pool, database, Gemini model or route provider is configured correctly.

Run the configuration inventory from the repository root:

```powershell
node --import tsx scripts/verify-live-services.mjs
```

This reads `.env.local`, `.env` and the current process environment, prints only configuration availability and makes no network requests. Existing process variables take priority. API keys, tokens, database URLs and private report contents are never printed.

After setting the deployment values described in [the setup guide](codearena26-setup.md), run:

```powershell
node --import tsx scripts/verify-live-services.mjs --live
```

The explicit `--live` option contacts the configured services. Gemini receives a tiny synthetic image and illustrative coordinates through the application's actual evaluator; it performs the three independent AI checks and aggregation, which consume API quota. The probe never creates a hazard report or alert. Set `LIVE_CHECK_ID_TOKEN` in the environment to an unexpired Cognito **ID token** for the authenticated checks; never put it in a committed file or shell command intended for sharing.

| Check | What a pass establishes | Required configuration |
| --- | --- | --- |
| Geography | The local loader accepts configured, operator-asserted verified ward/council data with `fixture: false`; no network request or authority/coverage certification | `HAZARD_GEOGRAPHY_JSON` or `HAZARD_GEOGRAPHY_FILE` |
| Gemini | Real image/location/risk responses and aggregation pass the actual adapter's structured validation | `GEMINI_API_KEY` or `GOOGLE_API_KEY`; optionally `HAZARD_GEMINI_MODEL` |
| Cognito keys | The configured pool exposes usable RS256 signing keys | Region, pool ID and app-client ID |
| Cognito session | The actual server verifier accepts signature, issuer, audience, expiry and ID-token type; resolves the actor's group-based role | Cognito configuration and `LIVE_CHECK_ID_TOKEN` |
| PostgreSQL | Read-only queries confirm migrations, PostGIS, initialized state, an available non-fixture shelter and usable active disaster boundaries | `DATABASE_URL` |
| OSRM | The actual adapter receives usable road geometry for synthetic Colombo endpoints | `OSRM_BASE_URL` with Sri Lanka coverage |
| AppSync | The configured gateway authorizes a read-only `__typename` query | `NEXT_PUBLIC_APPSYNC_GRAPHQL_URL` and `LIVE_CHECK_ID_TOKEN` |

Missing configuration is reported as `blocked`; a configured service that cannot complete its check is `failed`. A live run exits with code 2 unless every check passes. A configuration-only run always reports `not_validated`. There are no guessed success results or fallback demo providers in this script.

These checks do not test email/SMS delivery, Lambda business resolvers, S3 uploads, model accuracy, production capacity or emergency safety. Use an isolated staging deployment for end-to-end operator acceptance, with synthetic reports and approved test recipients. Verify real council/ward boundaries and shelter operations with the responsible authority before enabling live local alerts.

The protocol checks follow the providers' documentation: [Cognito token verification](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html), [PostgreSQL read-only transactions](https://www.postgresql.org/docs/17/runtime-config-client.html), and [OSRM HTTP API](https://project-osrm.org/docs/v26.4.0/http).
