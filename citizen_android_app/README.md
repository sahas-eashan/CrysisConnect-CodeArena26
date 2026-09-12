# CrisisConnect Citizen Android App

Android-only Flutter client for the citizen experience of CrisisConnect. The app now authenticates directly against Cognito and uses the provisioned AppSync GraphQL API for:

- citizen sign in / sign up / confirmation
- live dashboard, map, resources, and news reads
- real resource requests and SOS creation
- citizen-safe realtime updates for news, request status, and SOS status

## Project Structure

- `lib/main.dart`: minimal Android entrypoint
- `lib/app/`: top-level app shell and theme setup
- `lib/core/backend.dart`: mobile config, Amplify bootstrap, GraphQL documents, models, repository, GeoJSON helpers
- `lib/features/auth/`: Cognito auth gate and forms
- `lib/features/citizen/`: dashboard, map, SOS, and resources screens
- `assets/stitch/`: visual reference files pulled from Stitch

## Required Mobile Config

Pass the deployed AWS outputs as Dart defines. The app intentionally does not hardcode backend IDs.

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

You can also use `--dart-define-from-file=dart_defines.example.json` after copying and filling the sample file.

`CRISIS_HAZARD_API_URL` is the HTTPS origin of the deployed web app (no `/api/hazards` suffix). Its Cognito configuration must match this mobile app. Each candidate road route, including the short approaches to snapped road endpoints, is sent to `POST /api/hazards` with a Cognito ID token and the `screenRoute` action. The server checks new confirmed hazards, active weather warnings, and legacy disaster polygons before the app displays a route. Missing configuration, authentication failure, unavailable hazard data, or a failed server check means **no verified route**; there is no unchecked fallback. No Gemini key belongs in the mobile app.

For a local Android emulator in a debug build, the origin can be `http://10.0.2.2:3000`; the local web server still needs the same Cognito authentication configuration. Public origins and release builds require HTTPS. The URL can also be supplied as `CRISIS_HAZARD_API_URL` in `assets/config/runtime_config.json` when using asset configuration.

## Run

```bash
flutter pub get
flutter run --dart-define-from-file=dart_defines.example.json
```

## Verify

```bash
flutter analyze
flutter test
flutter build apk --debug
```

## Notes

- The map uses OpenStreetMap tiles plus live GeoJSON returned by the backend (`affectedArea`, `location`, `boundary`, `centerPoint`).
- Citizens now query `getMyResourceRequests` and `getMySOSSignals`, not the NGO/government-only admin queries.
- Android location permission is requested only when the app needs current position for safety routing, SOS, or request location capture.
