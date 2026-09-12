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
  --dart-define=CRISIS_APPSYNC_GRAPHQL_URL=https://example.appsync-api.ap-south-1.amazonaws.com/graphql
```

Optional:

```bash
--dart-define=CRISIS_APPSYNC_API_NAME=data
```

You can also use `--dart-define-from-file=dart_defines.example.json` after copying and filling the sample file.

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
