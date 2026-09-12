// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Sinhala Sinhalese (`si`).
class AppLocalizationsSi extends AppLocalizations {
  AppLocalizationsSi([String locale = 'si']) : super(locale);

  @override
  String get appTitle => 'CrisisConnect';

  @override
  String get signInTitle => 'පුරවැසි පිවිසුම';

  @override
  String get signUpTitle => 'නව ගිණුමක් සාදන්න';

  @override
  String get confirmTitle => 'ලියාපදිංචිය තහවුරු කරන්න';

  @override
  String get newPasswordTitle => 'නව මුරපදයක් සකසන්න';

  @override
  String get signInDesc =>
      'Cognito පරිශීලක සමූහයට සත්‍යාපනය වී AppSync හරහා සජීවී ආපදා දත්ත ලබා ගන්න.';

  @override
  String get signUpDesc => 'පුරවැසියන්ට ඊ-මේල් මගින් ස්වයං-ලියාපදිංචි විය හැක.';

  @override
  String get confirmDesc =>
      'Cognito විසින් එවන ලද තහවුරු කේතය ඇතුළත් කරන්න, ඉන්පසු පිවිසෙන්න.';

  @override
  String get newPasswordDesc =>
      'මෙම ගිණුම තාවකාලික මුරපදයකින් සෑදී ඇත. පළමු පිවිසුම සම්පූර්ණ කරන්න.';

  @override
  String get signInButton => 'පිවිසෙන්න';

  @override
  String get signUpButton => 'ගිණුම සාදන්න';

  @override
  String get confirmButton => 'ලියාපදිංචිය තහවුරු කරන්න';

  @override
  String get savePasswordButton => 'මුරපදය සුරකින්න';

  @override
  String get pleaseWait => 'කරුණාකර රැඳී සිටින්න...';

  @override
  String get needAccount => 'ගිණුමක් අවශ්‍යද? පුරවැසියෙකු ලෙස ලියාපදිංචි වන්න';

  @override
  String get backToSignIn => 'පිවිසුමට ආපසු යන්න';

  @override
  String get startSignInAgain => 'නැවත පිවිසෙන්න';

  @override
  String get fullName => 'සම්පූර්ණ නම';

  @override
  String get emailLabel => 'ඊ-මේල්';

  @override
  String get phoneNumber => 'දුරකථන අංකය';

  @override
  String get passwordLabel => 'මුරපදය';

  @override
  String get newPassword => 'නව මුරපදය';

  @override
  String get confirmationCode => 'තහවුරු කේතය';

  @override
  String get connectingMessage => 'CrisisConnect වෙත සම්බන්ධ වෙමින්...';

  @override
  String get citizenAccess => 'පුරවැසි ප්‍රවේශය';

  @override
  String get signOut => 'ඉවත් වන්න';

  @override
  String get languageLabel => 'Language / භාෂාව';

  @override
  String get selectLanguage => 'භාෂාව තෝරන්න';

  @override
  String get activeDisasters => 'සක්‍රිය ආපදා';

  @override
  String get safeZones => 'ආරක්‍ෂිත ස්ථාන';

  @override
  String get resources => 'සම්පත්';

  @override
  String get nearestSafeZones => 'ළඟම ආරක්‍ෂිත ස්ථාන';

  @override
  String get liveCrisisUpdates => 'සජීවී ආපදා යාවත්කාලීන';

  @override
  String get activeSectionTitle => 'සක්‍රිය ආපදා';

  @override
  String get activeSectionSubtitle => 'AppSync / PostGIS වෙතින් ලබා ගත්';

  @override
  String get realtimeNewsSubtitle => 'සජීවී පුවත් ප්‍රවාහය';

  @override
  String get noActiveAlerts => 'සක්‍රිය ආපදා අනතුරු ඇඟවීම් නැත';

  @override
  String get noActiveAlertsMsg =>
      'මෙම යෙදුම සජීවී බැක්එන්ඩ් එකට සම්බන්ධ වී ඇත. නව සිද්ධීන් සඳහා අදින්න.';

  @override
  String get noDisasterRecords => 'සක්‍රිය ආපදා වාර්තා ලැබී නැත.';

  @override
  String get noPublishedUpdates => 'ප්‍රකාශිත යාවත්කාලීන තවම නැත.';

  @override
  String get recommendedRoute => 'නිර්දේශිත මාර්ගය';

  @override
  String occupied(String percent) {
    return '$percent% පිරී ඇත';
  }

  @override
  String capacity(int current, int max) {
    return 'ධාරිතාව $current/$max';
  }

  @override
  String get retry => 'නැවත උත්සාහ කරන්න';

  @override
  String get navHome => 'මුල් පිටුව';

  @override
  String get navMap => 'සිතියම';

  @override
  String get navSos => 'SOS';

  @override
  String get navResources => 'සම්පත්';

  @override
  String get filterAll => 'සියල්ල';

  @override
  String get filterSafeZones => 'ආරක්‍ෂිත ස්ථාන';

  @override
  String get filterDisasters => 'ආපදා';

  @override
  String get filterResources => 'සම්පත්';

  @override
  String get liveMapBanner =>
      'AppSync + PostGIS සිට සජීවී පුරවැසි ආරක්‍ෂිත සිතියම';

  @override
  String get getMeToSafety => 'මාව ආරක්‍ෂිත ස්ථානයට ගෙන යන්න';

  @override
  String get inAppDirections => 'යෙදුම තුළ මාර්ගය';

  @override
  String get directionsButton => 'මාර්ගය';

  @override
  String get openInGoogleMaps => 'Google Maps තුළ විවෘත කරන්න';

  @override
  String get nearestSafeZone => 'ළඟම ආරක්‍ෂිත ස්ථානය';

  @override
  String get holdToSendSos => 'SOS යැවීමට\nඔබාගෙන සිටින්න';

  @override
  String get sosInstruction =>
      'ඔබගේ ස්ථානය CrisisConnect ප්‍රතිචාරක ජාලයට යැවීමට තත්පර 3ක් ඔබාගෙන සිටින්න.';

  @override
  String get emergencyType => 'හදිසි අවස්ථා වර්ගය';

  @override
  String get describeSituation => 'තත්ත්වය විස්තර කරන්න';

  @override
  String get mySosStatus => 'මගේ SOS තත්ත්වය';

  @override
  String get sosHistoryEmpty =>
      'පළමු හදිසි ඉල්ලීමෙන් පසු ඔබගේ SOS ඉතිහාසය මෙහි දිස් වනු ඇත.';

  @override
  String get sosSent => 'SOS යවන ලදී. ප්‍රතිචාරකයින්ට දැනුම් දී ඇත.';

  @override
  String get locationUnavailable =>
      'වත්මන් ස්ථානය ලබා ගත නොහැක. SOS යැවීමේදී අවසරය ඉල්ලා සිටිනු ඇත.';

  @override
  String get locationReady => 'වත්මන් ස්ථානය ලබා ගෙන හදිසි සේවා සඳහා සූදානම්.';

  @override
  String get noDescription => 'විස්තරයක් ලබා දී නැත.';

  @override
  String get helpOnTheWay => 'උදව් එමින් පවතී';

  @override
  String get emergencyClosed => 'හදිසි අවස්ථාව වසා ඇත';

  @override
  String get awaitingDispatch => 'යැවීම බලාපොරොත්තුවෙන්';

  @override
  String get awaitingResponder => 'ආසන්නතම ප්‍රතිචාරක පැවරීම බලාපොරොත්තුවෙන්';

  @override
  String kmAway(String distance) {
    return 'කි.මි. $distance ඈතින්';
  }

  @override
  String get medical => 'වෛද්‍ය';

  @override
  String get trapped => 'සිරවී ඇත';

  @override
  String get evacuation => 'ඉවත් කිරීම';

  @override
  String get resourcesType => 'සම්පත්';

  @override
  String get searchSupplies => 'සැපයුම් සොයන්න';

  @override
  String get liveResourceCatalog => 'සජීවී සම්පත් නාමාවලිය';

  @override
  String get noResourcesMatch => 'ඔබගේ පෙරණයට ගැළපෙන සම්පත් නැත.';

  @override
  String get myActiveRequests => 'මගේ සක්‍රිය ඉල්ලීම්';

  @override
  String get requestHistoryEmpty =>
      'සම්පත් ඉල්ලීමක් ඉදිරිපත් කළ පසු ඔබගේ ඉල්ලීම් ඉතිහාසය මෙහි දිස් වනු ඇත.';

  @override
  String get requestButton => 'ඉල්ලන්න';

  @override
  String get requestUnlistedItem => 'ලැයිස්තුවේ නැති අයිතමයක් ඉල්ලන්න';

  @override
  String get requestUnlistedDescription =>
      'නාමාවලියේ නැති දෙයක් අවශ්‍යද? ඒ සඳහා අභිරුචි ඉල්ලීමක් යවන්න.';

  @override
  String requestDialogTitle(String name) {
    return '$name ඉල්ලන්න';
  }

  @override
  String get itemName => 'අයිතමයේ නම';

  @override
  String get itemNameRequired => 'ඔබට අවශ්‍ය අයිතමය ඇතුළත් කරන්න.';

  @override
  String get quantityNeeded => 'අවශ්‍ය ප්‍රමාණය';

  @override
  String get urgency => 'හදිසි බව';

  @override
  String get urgencyNormal => 'සාමාන්‍ය';

  @override
  String get urgencyHigh => 'ඉහළ';

  @override
  String get urgencyCritical => 'බරපතල';

  @override
  String get cancelButton => 'අවලංගු කරන්න';

  @override
  String get submitButton => 'ඉදිරිපත් කරන්න';

  @override
  String get resourceRequestSuccess =>
      'සම්පත් ඉල්ලීම සාර්ථකව ඉදිරිපත් කරන ලදී.';

  @override
  String managedBy(String name) {
    return '$name විසින් කළමනාකරණය කරන ලදී';
  }

  @override
  String get units => 'ඒකක';

  @override
  String get priority => 'ප්‍රමුඛතාව';

  @override
  String get customRequest => 'අභිරුචි ඉල්ලීම';

  @override
  String get categoryAll => 'සියල්ල';

  @override
  String get categoryFood => 'ආහාර';

  @override
  String get categoryWater => 'ජලය';

  @override
  String get categoryMedical => 'වෛද්‍ය';

  @override
  String get categoryShelter => 'නවාතැන්';

  @override
  String get retryMapLoad => 'සිතියම නැවත පූරණය කරන්න';

  @override
  String get backendConfigRequired => 'Backend config අවශ්‍යයි';

  @override
  String get backendConfigMessage =>
      'AWS outputs dart-defines ලෙස සපයා Android යෙදුම ක්‍රියාත්මක කරන්න.';

  @override
  String get navigating => 'මාර්ගගත වෙමින්...';

  @override
  String routeDistance(String distance) {
    return 'කි.මී. $distance';
  }

  @override
  String routeDuration(String minutes) {
    return 'මිනි. $minutes';
  }

  @override
  String get cancelNavigation => 'අවලංගු කරන්න';

  @override
  String get routeNotFound => 'මෙම ස්ථානයට මාර්ගයක් සොයා ගත නොහැක.';

  @override
  String get locationNeeded => 'මාර්ගය සඳහා වත්මන් ස්ථානය අවශ්‍යයි.';

  @override
  String get googleMapsOpenFailed => 'Google Maps මාර්ගය විවෘත කළ නොහැක.';
}
