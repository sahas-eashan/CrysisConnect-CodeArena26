// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'CrisisConnect';

  @override
  String get signInTitle => 'Citizen Sign In';

  @override
  String get signUpTitle => 'Create Citizen Account';

  @override
  String get confirmTitle => 'Confirm Registration';

  @override
  String get newPasswordTitle => 'Set A New Password';

  @override
  String get signInDesc =>
      'Authenticate directly against the provisioned Cognito user pool and fetch live incident data from AppSync.';

  @override
  String get signUpDesc =>
      'Citizens can self-register with email. After confirmation, the mobile app uses the same AWS backend as the web portal.';

  @override
  String get confirmDesc =>
      'Enter the confirmation code sent by Cognito, then sign in to start using live disaster data.';

  @override
  String get newPasswordDesc =>
      'This Cognito account was created with a temporary password. Set a permanent password to finish the first sign-in.';

  @override
  String get signInButton => 'Sign in';

  @override
  String get signUpButton => 'Create account';

  @override
  String get confirmButton => 'Confirm registration';

  @override
  String get savePasswordButton => 'Save new password';

  @override
  String get pleaseWait => 'Please wait...';

  @override
  String get needAccount => 'Need an account? Register as a citizen';

  @override
  String get backToSignIn => 'Back to sign in';

  @override
  String get startSignInAgain => 'Start sign in again';

  @override
  String get fullName => 'Full name';

  @override
  String get emailLabel => 'Email';

  @override
  String get phoneNumber => 'Phone number';

  @override
  String get passwordLabel => 'Password';

  @override
  String get newPassword => 'New password';

  @override
  String get confirmationCode => 'Confirmation code';

  @override
  String get connectingMessage => 'Connecting to CrisisConnect...';

  @override
  String get citizenAccess => 'Citizen access';

  @override
  String get signOut => 'Sign out';

  @override
  String get languageLabel => 'Language / භාෂාව';

  @override
  String get selectLanguage => 'Select Language / භාෂාව තෝරන්න';

  @override
  String get activeDisasters => 'Active disasters';

  @override
  String get safeZones => 'Safe zones';

  @override
  String get resources => 'Resources';

  @override
  String get nearestSafeZones => 'Nearest safe zones';

  @override
  String get liveCrisisUpdates => 'Live Crisis Updates';

  @override
  String get activeSectionTitle => 'Active Disasters';

  @override
  String get activeSectionSubtitle => 'Fetched from AppSync / PostGIS';

  @override
  String get realtimeNewsSubtitle => 'Realtime news stream';

  @override
  String get noActiveAlerts => 'No active disaster alerts';

  @override
  String get noActiveAlertsMsg =>
      'This citizen app is now connected to the live backend. Pull to refresh for new incidents.';

  @override
  String get noDisasterRecords => 'No active disaster records were returned.';

  @override
  String get noPublishedUpdates => 'No published updates are available yet.';

  @override
  String get recommendedRoute => 'Recommended route';

  @override
  String occupied(String percent) {
    return '$percent% occupied';
  }

  @override
  String capacity(int current, int max) {
    return 'Capacity $current/$max';
  }

  @override
  String get retry => 'Retry';

  @override
  String get navHome => 'Home';

  @override
  String get navMap => 'Map';

  @override
  String get navSos => 'SOS';

  @override
  String get navResources => 'Resources';

  @override
  String get filterAll => 'All';

  @override
  String get filterSafeZones => 'Safe Zones';

  @override
  String get filterDisasters => 'Disasters';

  @override
  String get filterResources => 'Resources';

  @override
  String get liveMapBanner => 'Live citizen safety map from AppSync + PostGIS';

  @override
  String get getMeToSafety => 'Get Me To Safety';

  @override
  String get inAppDirections => 'In-app directions';

  @override
  String get directionsButton => 'Directions';

  @override
  String get openInGoogleMaps => 'Open in Google Maps';

  @override
  String get nearestSafeZone => 'Nearest Safe Zone';

  @override
  String get holdToSendSos => 'HOLD TO\nSEND SOS';

  @override
  String get sosInstruction =>
      'Press and hold for 3 seconds to send your location to the live CrisisConnect responder network.';

  @override
  String get emergencyType => 'Emergency Type';

  @override
  String get describeSituation => 'Describe the situation';

  @override
  String get mySosStatus => 'My SOS Status';

  @override
  String get sosHistoryEmpty =>
      'Your SOS history will appear here after the first emergency request.';

  @override
  String get sosSent => 'SOS sent. Responders have been notified.';

  @override
  String get locationUnavailable =>
      'Current location unavailable. Permission will be requested when you send SOS.';

  @override
  String get locationReady =>
      'Current location captured and ready for emergency dispatch.';

  @override
  String get noDescription => 'No description provided.';

  @override
  String get helpOnTheWay => 'Help is on the way';

  @override
  String get emergencyClosed => 'Emergency closed';

  @override
  String get awaitingDispatch => 'Awaiting dispatch';

  @override
  String get awaitingResponder => 'Awaiting nearest responder assignment';

  @override
  String kmAway(String distance) {
    return '$distance km away';
  }

  @override
  String get medical => 'Medical';

  @override
  String get trapped => 'Trapped';

  @override
  String get evacuation => 'Evacuation';

  @override
  String get resourcesType => 'Resources';

  @override
  String get searchSupplies => 'Search supplies';

  @override
  String get liveResourceCatalog => 'Live Resource Catalog';

  @override
  String get noResourcesMatch => 'No resources match your current filter.';

  @override
  String get myActiveRequests => 'My Active Requests';

  @override
  String get requestHistoryEmpty =>
      'Your request history will appear here once you submit a resource request.';

  @override
  String get requestButton => 'Request';

  @override
  String get requestUnlistedItem => 'Request unlisted item';

  @override
  String get requestUnlistedDescription =>
      'Need something not in the catalog? Send a custom request for it.';

  @override
  String requestDialogTitle(String name) {
    return 'Request $name';
  }

  @override
  String get itemName => 'Item name';

  @override
  String get itemNameRequired => 'Enter the item you need.';

  @override
  String get quantityNeeded => 'Quantity needed';

  @override
  String get urgency => 'Urgency';

  @override
  String get urgencyNormal => 'Normal';

  @override
  String get urgencyHigh => 'High';

  @override
  String get urgencyCritical => 'Critical';

  @override
  String get cancelButton => 'Cancel';

  @override
  String get submitButton => 'Submit';

  @override
  String get resourceRequestSuccess =>
      'Resource request submitted successfully.';

  @override
  String managedBy(String name) {
    return 'Managed by $name';
  }

  @override
  String get units => 'units';

  @override
  String get priority => 'priority';

  @override
  String get customRequest => 'Custom request';

  @override
  String get categoryAll => 'All';

  @override
  String get categoryFood => 'Food';

  @override
  String get categoryWater => 'Water';

  @override
  String get categoryMedical => 'Medical';

  @override
  String get categoryShelter => 'Shelter';

  @override
  String get retryMapLoad => 'Retry map load';

  @override
  String get backendConfigRequired => 'Backend config required';

  @override
  String get backendConfigMessage =>
      'Run the Android app with the deployed AWS outputs supplied as dart-defines.';

  @override
  String get navigating => 'Navigating...';

  @override
  String routeDistance(String distance) {
    return '$distance km';
  }

  @override
  String routeDuration(String minutes) {
    return '$minutes min';
  }

  @override
  String get cancelNavigation => 'Cancel';

  @override
  String get routeNotFound => 'Could not find a route to this location.';

  @override
  String get locationNeeded => 'Current location is needed for routing.';

  @override
  String get googleMapsOpenFailed => 'Could not open Google Maps directions.';
}
