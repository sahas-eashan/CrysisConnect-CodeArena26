import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_si.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('si'),
  ];

  /// App title
  ///
  /// In en, this message translates to:
  /// **'CrisisConnect'**
  String get appTitle;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Citizen Sign In'**
  String get signInTitle;

  /// No description provided for @signUpTitle.
  ///
  /// In en, this message translates to:
  /// **'Create Citizen Account'**
  String get signUpTitle;

  /// No description provided for @confirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm Registration'**
  String get confirmTitle;

  /// No description provided for @newPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Set A New Password'**
  String get newPasswordTitle;

  /// No description provided for @signInDesc.
  ///
  /// In en, this message translates to:
  /// **'Authenticate directly against the provisioned Cognito user pool and fetch live incident data from AppSync.'**
  String get signInDesc;

  /// No description provided for @signUpDesc.
  ///
  /// In en, this message translates to:
  /// **'Citizens can self-register with email. After confirmation, the mobile app uses the same AWS backend as the web portal.'**
  String get signUpDesc;

  /// No description provided for @confirmDesc.
  ///
  /// In en, this message translates to:
  /// **'Enter the confirmation code sent by Cognito, then sign in to start using live disaster data.'**
  String get confirmDesc;

  /// No description provided for @newPasswordDesc.
  ///
  /// In en, this message translates to:
  /// **'This Cognito account was created with a temporary password. Set a permanent password to finish the first sign-in.'**
  String get newPasswordDesc;

  /// No description provided for @signInButton.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signInButton;

  /// No description provided for @signUpButton.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get signUpButton;

  /// No description provided for @confirmButton.
  ///
  /// In en, this message translates to:
  /// **'Confirm registration'**
  String get confirmButton;

  /// No description provided for @savePasswordButton.
  ///
  /// In en, this message translates to:
  /// **'Save new password'**
  String get savePasswordButton;

  /// No description provided for @pleaseWait.
  ///
  /// In en, this message translates to:
  /// **'Please wait...'**
  String get pleaseWait;

  /// No description provided for @needAccount.
  ///
  /// In en, this message translates to:
  /// **'Need an account? Register as a citizen'**
  String get needAccount;

  /// No description provided for @backToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get backToSignIn;

  /// No description provided for @startSignInAgain.
  ///
  /// In en, this message translates to:
  /// **'Start sign in again'**
  String get startSignInAgain;

  /// No description provided for @fullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fullName;

  /// No description provided for @emailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailLabel;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get phoneNumber;

  /// No description provided for @passwordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordLabel;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get newPassword;

  /// No description provided for @confirmationCode.
  ///
  /// In en, this message translates to:
  /// **'Confirmation code'**
  String get confirmationCode;

  /// No description provided for @connectingMessage.
  ///
  /// In en, this message translates to:
  /// **'Connecting to CrisisConnect...'**
  String get connectingMessage;

  /// No description provided for @citizenAccess.
  ///
  /// In en, this message translates to:
  /// **'Citizen access'**
  String get citizenAccess;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @languageLabel.
  ///
  /// In en, this message translates to:
  /// **'Language / භාෂාව'**
  String get languageLabel;

  /// No description provided for @selectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select Language / භාෂාව තෝරන්න'**
  String get selectLanguage;

  /// No description provided for @activeDisasters.
  ///
  /// In en, this message translates to:
  /// **'Active disasters'**
  String get activeDisasters;

  /// No description provided for @safeZones.
  ///
  /// In en, this message translates to:
  /// **'Safe zones'**
  String get safeZones;

  /// No description provided for @resources.
  ///
  /// In en, this message translates to:
  /// **'Resources'**
  String get resources;

  /// No description provided for @nearestSafeZones.
  ///
  /// In en, this message translates to:
  /// **'Nearest safe zones'**
  String get nearestSafeZones;

  /// No description provided for @liveCrisisUpdates.
  ///
  /// In en, this message translates to:
  /// **'Live Crisis Updates'**
  String get liveCrisisUpdates;

  /// No description provided for @activeSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Active Disasters'**
  String get activeSectionTitle;

  /// No description provided for @activeSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Fetched from AppSync / PostGIS'**
  String get activeSectionSubtitle;

  /// No description provided for @realtimeNewsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Realtime news stream'**
  String get realtimeNewsSubtitle;

  /// No description provided for @noActiveAlerts.
  ///
  /// In en, this message translates to:
  /// **'No active disaster alerts'**
  String get noActiveAlerts;

  /// No description provided for @noActiveAlertsMsg.
  ///
  /// In en, this message translates to:
  /// **'This citizen app is now connected to the live backend. Pull to refresh for new incidents.'**
  String get noActiveAlertsMsg;

  /// No description provided for @noDisasterRecords.
  ///
  /// In en, this message translates to:
  /// **'No active disaster records were returned.'**
  String get noDisasterRecords;

  /// No description provided for @noPublishedUpdates.
  ///
  /// In en, this message translates to:
  /// **'No published updates are available yet.'**
  String get noPublishedUpdates;

  /// No description provided for @recommendedRoute.
  ///
  /// In en, this message translates to:
  /// **'Recommended route'**
  String get recommendedRoute;

  /// No description provided for @occupied.
  ///
  /// In en, this message translates to:
  /// **'{percent}% occupied'**
  String occupied(String percent);

  /// No description provided for @capacity.
  ///
  /// In en, this message translates to:
  /// **'Capacity {current}/{max}'**
  String capacity(int current, int max);

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navMap.
  ///
  /// In en, this message translates to:
  /// **'Map'**
  String get navMap;

  /// No description provided for @navSos.
  ///
  /// In en, this message translates to:
  /// **'SOS'**
  String get navSos;

  /// No description provided for @navResources.
  ///
  /// In en, this message translates to:
  /// **'Resources'**
  String get navResources;

  /// No description provided for @filterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get filterAll;

  /// No description provided for @filterSafeZones.
  ///
  /// In en, this message translates to:
  /// **'Safe Zones'**
  String get filterSafeZones;

  /// No description provided for @filterDisasters.
  ///
  /// In en, this message translates to:
  /// **'Disasters'**
  String get filterDisasters;

  /// No description provided for @filterResources.
  ///
  /// In en, this message translates to:
  /// **'Resources'**
  String get filterResources;

  /// No description provided for @liveMapBanner.
  ///
  /// In en, this message translates to:
  /// **'Live citizen safety map from AppSync + PostGIS'**
  String get liveMapBanner;

  /// No description provided for @getMeToSafety.
  ///
  /// In en, this message translates to:
  /// **'Get Me To Safety'**
  String get getMeToSafety;

  /// No description provided for @inAppDirections.
  ///
  /// In en, this message translates to:
  /// **'In-app directions'**
  String get inAppDirections;

  /// No description provided for @directionsButton.
  ///
  /// In en, this message translates to:
  /// **'Directions'**
  String get directionsButton;

  /// No description provided for @openInGoogleMaps.
  ///
  /// In en, this message translates to:
  /// **'Open in Google Maps'**
  String get openInGoogleMaps;

  /// No description provided for @nearestSafeZone.
  ///
  /// In en, this message translates to:
  /// **'Nearest Safe Zone'**
  String get nearestSafeZone;

  /// No description provided for @holdToSendSos.
  ///
  /// In en, this message translates to:
  /// **'HOLD TO\nSEND SOS'**
  String get holdToSendSos;

  /// No description provided for @sosInstruction.
  ///
  /// In en, this message translates to:
  /// **'Press and hold for 3 seconds to send your location to the live CrisisConnect responder network.'**
  String get sosInstruction;

  /// No description provided for @emergencyType.
  ///
  /// In en, this message translates to:
  /// **'Emergency Type'**
  String get emergencyType;

  /// No description provided for @describeSituation.
  ///
  /// In en, this message translates to:
  /// **'Describe the situation'**
  String get describeSituation;

  /// No description provided for @mySosStatus.
  ///
  /// In en, this message translates to:
  /// **'My SOS Status'**
  String get mySosStatus;

  /// No description provided for @sosHistoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your SOS history will appear here after the first emergency request.'**
  String get sosHistoryEmpty;

  /// No description provided for @sosSent.
  ///
  /// In en, this message translates to:
  /// **'SOS sent. Responders have been notified.'**
  String get sosSent;

  /// No description provided for @locationUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Current location unavailable. Permission will be requested when you send SOS.'**
  String get locationUnavailable;

  /// No description provided for @locationReady.
  ///
  /// In en, this message translates to:
  /// **'Current location captured and ready for emergency dispatch.'**
  String get locationReady;

  /// No description provided for @noDescription.
  ///
  /// In en, this message translates to:
  /// **'No description provided.'**
  String get noDescription;

  /// No description provided for @helpOnTheWay.
  ///
  /// In en, this message translates to:
  /// **'Help is on the way'**
  String get helpOnTheWay;

  /// No description provided for @emergencyClosed.
  ///
  /// In en, this message translates to:
  /// **'Emergency closed'**
  String get emergencyClosed;

  /// No description provided for @awaitingDispatch.
  ///
  /// In en, this message translates to:
  /// **'Awaiting dispatch'**
  String get awaitingDispatch;

  /// No description provided for @awaitingResponder.
  ///
  /// In en, this message translates to:
  /// **'Awaiting nearest responder assignment'**
  String get awaitingResponder;

  /// No description provided for @kmAway.
  ///
  /// In en, this message translates to:
  /// **'{distance} km away'**
  String kmAway(String distance);

  /// No description provided for @medical.
  ///
  /// In en, this message translates to:
  /// **'Medical'**
  String get medical;

  /// No description provided for @trapped.
  ///
  /// In en, this message translates to:
  /// **'Trapped'**
  String get trapped;

  /// No description provided for @evacuation.
  ///
  /// In en, this message translates to:
  /// **'Evacuation'**
  String get evacuation;

  /// No description provided for @resourcesType.
  ///
  /// In en, this message translates to:
  /// **'Resources'**
  String get resourcesType;

  /// No description provided for @searchSupplies.
  ///
  /// In en, this message translates to:
  /// **'Search supplies'**
  String get searchSupplies;

  /// No description provided for @liveResourceCatalog.
  ///
  /// In en, this message translates to:
  /// **'Live Resource Catalog'**
  String get liveResourceCatalog;

  /// No description provided for @noResourcesMatch.
  ///
  /// In en, this message translates to:
  /// **'No resources match your current filter.'**
  String get noResourcesMatch;

  /// No description provided for @myActiveRequests.
  ///
  /// In en, this message translates to:
  /// **'My Active Requests'**
  String get myActiveRequests;

  /// No description provided for @requestHistoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'Your request history will appear here once you submit a resource request.'**
  String get requestHistoryEmpty;

  /// No description provided for @requestButton.
  ///
  /// In en, this message translates to:
  /// **'Request'**
  String get requestButton;

  /// No description provided for @requestUnlistedItem.
  ///
  /// In en, this message translates to:
  /// **'Request unlisted item'**
  String get requestUnlistedItem;

  /// No description provided for @requestUnlistedDescription.
  ///
  /// In en, this message translates to:
  /// **'Need something not in the catalog? Send a custom request for it.'**
  String get requestUnlistedDescription;

  /// No description provided for @requestDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Request {name}'**
  String requestDialogTitle(String name);

  /// No description provided for @itemName.
  ///
  /// In en, this message translates to:
  /// **'Item name'**
  String get itemName;

  /// No description provided for @itemNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter the item you need.'**
  String get itemNameRequired;

  /// No description provided for @quantityNeeded.
  ///
  /// In en, this message translates to:
  /// **'Quantity needed'**
  String get quantityNeeded;

  /// No description provided for @urgency.
  ///
  /// In en, this message translates to:
  /// **'Urgency'**
  String get urgency;

  /// No description provided for @urgencyNormal.
  ///
  /// In en, this message translates to:
  /// **'Normal'**
  String get urgencyNormal;

  /// No description provided for @urgencyHigh.
  ///
  /// In en, this message translates to:
  /// **'High'**
  String get urgencyHigh;

  /// No description provided for @urgencyCritical.
  ///
  /// In en, this message translates to:
  /// **'Critical'**
  String get urgencyCritical;

  /// No description provided for @cancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelButton;

  /// No description provided for @submitButton.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get submitButton;

  /// No description provided for @resourceRequestSuccess.
  ///
  /// In en, this message translates to:
  /// **'Resource request submitted successfully.'**
  String get resourceRequestSuccess;

  /// No description provided for @managedBy.
  ///
  /// In en, this message translates to:
  /// **'Managed by {name}'**
  String managedBy(String name);

  /// No description provided for @units.
  ///
  /// In en, this message translates to:
  /// **'units'**
  String get units;

  /// No description provided for @priority.
  ///
  /// In en, this message translates to:
  /// **'priority'**
  String get priority;

  /// No description provided for @customRequest.
  ///
  /// In en, this message translates to:
  /// **'Custom request'**
  String get customRequest;

  /// No description provided for @categoryAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get categoryAll;

  /// No description provided for @categoryFood.
  ///
  /// In en, this message translates to:
  /// **'Food'**
  String get categoryFood;

  /// No description provided for @categoryWater.
  ///
  /// In en, this message translates to:
  /// **'Water'**
  String get categoryWater;

  /// No description provided for @categoryMedical.
  ///
  /// In en, this message translates to:
  /// **'Medical'**
  String get categoryMedical;

  /// No description provided for @categoryShelter.
  ///
  /// In en, this message translates to:
  /// **'Shelter'**
  String get categoryShelter;

  /// No description provided for @retryMapLoad.
  ///
  /// In en, this message translates to:
  /// **'Retry map load'**
  String get retryMapLoad;

  /// No description provided for @backendConfigRequired.
  ///
  /// In en, this message translates to:
  /// **'Backend config required'**
  String get backendConfigRequired;

  /// No description provided for @backendConfigMessage.
  ///
  /// In en, this message translates to:
  /// **'Run the Android app with the deployed AWS outputs supplied as dart-defines.'**
  String get backendConfigMessage;

  /// No description provided for @navigating.
  ///
  /// In en, this message translates to:
  /// **'Navigating...'**
  String get navigating;

  /// No description provided for @routeDistance.
  ///
  /// In en, this message translates to:
  /// **'{distance} km'**
  String routeDistance(String distance);

  /// No description provided for @routeDuration.
  ///
  /// In en, this message translates to:
  /// **'{minutes} min'**
  String routeDuration(String minutes);

  /// No description provided for @cancelNavigation.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelNavigation;

  /// No description provided for @routeNotFound.
  ///
  /// In en, this message translates to:
  /// **'Could not find a route to this location.'**
  String get routeNotFound;

  /// No description provided for @locationNeeded.
  ///
  /// In en, this message translates to:
  /// **'Current location is needed for routing.'**
  String get locationNeeded;

  /// No description provided for @googleMapsOpenFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not open Google Maps directions.'**
  String get googleMapsOpenFailed;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'si'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'si':
      return AppLocalizationsSi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
