import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A [ChangeNotifier] that stores the user's chosen locale and persists it
/// across app restarts using [SharedPreferences].
class LocaleNotifier extends ChangeNotifier {
  LocaleNotifier() {
    _load();
  }

  static const _key = 'app_locale';

  Locale? _locale; // null = use system default

  Locale? get locale => _locale;

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_key);
    if (code != null) {
      _locale = Locale(code);
      notifyListeners();
    }
  }

  Future<void> setLocale(Locale locale) async {
    _locale = locale;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, locale.languageCode);
  }

  Future<void> clearLocale() async {
    _locale = null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
