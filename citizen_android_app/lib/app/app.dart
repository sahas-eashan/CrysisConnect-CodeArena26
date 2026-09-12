import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/core/locale_notifier.dart';
import 'package:crisisconnect_citizen/features/auth/auth_gate.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';

class CrisisConnectApp extends StatefulWidget {
  const CrisisConnectApp({super.key});

  /// Allows any widget in the tree to access the [LocaleNotifier].
  static LocaleNotifier localeOf(BuildContext context) {
    return context.findAncestorStateOfType<_CrisisConnectAppState>()!._localeNotifier;
  }

  @override
  State<CrisisConnectApp> createState() => _CrisisConnectAppState();
}

class _CrisisConnectAppState extends State<CrisisConnectApp> {
  final LocaleNotifier _localeNotifier = LocaleNotifier();

  @override
  void dispose() {
    _localeNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = GoogleFonts.interTextTheme().apply(
      bodyColor: AppColors.onSurface,
      displayColor: AppColors.onSurface,
    );

    return ListenableBuilder(
      listenable: _localeNotifier,
      builder: (context, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'CrisisConnect Citizen',
          builder: (context, child) {
            return AnnotatedRegion<SystemUiOverlayStyle>(
              value: const SystemUiOverlayStyle(
                statusBarColor: AppColors.surfaceLowest,
                statusBarIconBrightness: Brightness.dark,
                statusBarBrightness: Brightness.light,
              ),
              child: child ?? const SizedBox.shrink(),
            );
          },
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('en'),
            Locale('si'),
          ],
          locale: _localeNotifier.locale, // null = follow system
          theme: ThemeData(
            useMaterial3: true,
            scaffoldBackgroundColor: AppColors.background,
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              secondary: AppColors.secondary,
              surface: AppColors.surfaceLowest,
              error: AppColors.error,
              onPrimary: Colors.white,
              onSecondary: Colors.white,
              onSurface: AppColors.onSurface,
              onError: Colors.white,
            ),
            textTheme: textTheme,
            snackBarTheme: SnackBarThemeData(
              backgroundColor: AppColors.inverseSurface,
              contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: AppColors.surfaceHigh,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 18,
                vertical: 18,
              ),
              hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.outline),
            ),
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(22),
                ),
                textStyle: textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          home: const AuthGate(),
        );
      },
    );
  }
}
