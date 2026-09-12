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
  String get signInButton => 'Sign In';

  @override
  String get dashboardTitle => 'Citizen Portal';

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
}
