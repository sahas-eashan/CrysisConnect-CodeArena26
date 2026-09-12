# CrisisConnect Citizen Android App

Android-only Flutter client for the citizen experience of CrisisConnect. With Cognito and AppSync configured, it provides:

- citizen sign in / sign up / confirmation
- live dashboard, map, resources, and news reads
- real resource requests and SOS creation
- citizen-scoped realtime updates for news, request status, and SOS status

Photo-based hazard reports, evidence review, crew closure and relief coordination are available in the responsive [web portals](../README.md).

## Project Structure

- `lib/main.dart`: minimal Android entrypoint
- `lib/app/`: top-level app shell and theme setup
- `lib/core/backend.dart`: mobile config, Amplify bootstrap, GraphQL documents, models, repository, GeoJSON helpers
- `lib/features/auth/`: Cognito auth gate and forms
- `lib/features/citizen/`: dashboard, map, SOS, and resources screens
- `assets/config/`: deployment configuration template

## Required Mobile Config

Pass your deployment's AWS outputs as Dart defines. The web and mobile clients must use the same Cognito user pool and app client.

```bash
flutter run \
  --dart-define=CRISIS_AWS_REGION=ap-south-1 \
  --dart-define=CRISIS_COGNITO_USER_POOL_ID=ap-south-1_example \
  --dart-define=CRISIS_COGNITO_USER_POOL_CLIENT_ID=exampleclientid \
  --dart-define=CRISIS_APPSYNC_GRAPHQL_URL=https://example.appsync-api.ap-south-1.amazonaws.com/graphql \
  --dart-define=CRISIS_HAZARD_API_URL=https://your-crysisconnect.example
```

Optional:

```bash
--dart-define=CRISIS_APPSYNC_API_NAME=data
```

Copy `dart_defines.example.json` to `dart_defines.local.json`, fill in the deployment values, and use `--dart-define-from-file=dart_defines.local.json`. The local configuration file is ignored by Git.

The bundled `assets/config/runtime_config.json` contains empty deployment fields. Supply the configuration explicitly before signing in; the app shows setup guidance when the required fields are absent.

`CRISIS_HAZARD_API_URL` is the HTTPS origin of the deployed web app (no `/api/hazards` suffix). Its Cognito configuration must match this mobile app. Each candidate road route, including the short approaches to snapped road endpoints, is sent to `POST /api/hazards` with a Cognito ID token and the `screenRoute` action. The server checks confirmed hazards, active weather warnings, and AppSync disaster polygons before the app displays a route. Missing configuration, authentication failure, unavailable hazard data, or a failed server check means **no screened route**. Screening checks recorded hazards; it cannot guarantee current road conditions. No Gemini key belongs in the mobile app.

For a local Android emulator in a debug build, the origin can be `http://10.0.2.2:3000`; the local web server still needs the same Cognito authentication configuration. Public origins and release builds require HTTPS. The URL can also be supplied as `CRISIS_HAZARD_API_URL` in `assets/config/runtime_config.json` when using asset configuration.

## Run

```bash
flutter pub get
flutter run --dart-define-from-file=dart_defines.local.json
```

## Verify

```bash
flutter analyze
flutter test
flutter build apk --debug
```

## Notes

- The map uses OpenStreetMap tiles plus live GeoJSON returned by the backend (`affectedArea`, `location`, `boundary`, `centerPoint`).
- Citizen requests use the account-scoped `getMyResourceRequests` and `getMySOSSignals` queries.
- Android location permission is requested only when the app needs current position for safety routing, SOS, or request location capture.
