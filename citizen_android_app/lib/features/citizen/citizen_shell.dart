import 'package:crisisconnect_citizen/app/app.dart';
import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/features/citizen/dashboard_screen.dart';
import 'package:crisisconnect_citizen/features/citizen/map_screen.dart';
import 'package:crisisconnect_citizen/features/citizen/resources_screen.dart';
import 'package:crisisconnect_citizen/features/citizen/sos_screen.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class CitizenShell extends StatefulWidget {
  const CitizenShell({
    super.key,
    required this.session,
    required this.repository,
    required this.onSignOut,
  });

  final AppSession session;
  final CitizenRepository repository;
  final Future<void> Function() onSignOut;

  @override
  State<CitizenShell> createState() => _CitizenShellState();
}

class _CitizenShellState extends State<CitizenShell> {
  int _currentIndex = 0;

  void _showLanguagePicker(BuildContext context) {
    final localeNotifier = CrisisConnectApp.localeOf(context);
    final currentCode = localeNotifier.locale?.languageCode;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                AppLocalizations.of(context)!.selectLanguage,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 16),
              _LanguageTile(
                flag: '🇬🇧',
                title: 'English',
                subtitle: 'English',
                selected: currentCode == 'en' || currentCode == null,
                onTap: () {
                  localeNotifier.setLocale(const Locale('en'));
                  Navigator.pop(sheetContext);
                },
              ),
              const SizedBox(height: 8),
              _LanguageTile(
                flag: '🇱🇰',
                title: 'සිංහල',
                subtitle: 'Sinhala',
                selected: currentCode == 'si',
                onTap: () {
                  localeNotifier.setLocale(const Locale('si'));
                  Navigator.pop(sheetContext);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      DashboardScreen(
        repository: widget.repository,
        userId: widget.session.userId ?? '',
      ),
      MapScreen(repository: widget.repository),
      SosScreen(
        repository: widget.repository,
        userId: widget.session.userId ?? '',
      ),
      ResourcesScreen(
        repository: widget.repository,
        userId: widget.session.userId ?? '',
      ),
    ];

    return Scaffold(
      extendBody: true,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.background, AppColors.surfaceLow],
          ),
        ),
        child: Column(
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.surfaceLowest,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(24),
                  bottomRight: Radius.circular(24),
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.inverseSurface.withValues(alpha: 0.08),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 14),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.shield_rounded,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'CrisisConnect',
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            Text(
                              widget.session.username ?? AppLocalizations.of(context)!.citizenAccess,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: AppColors.outline),
                            ),
                          ],
                        ),
                      ),
                      PopupMenuButton<String>(
                        onSelected: (value) async {
                          if (value == 'logout') {
                            await widget.onSignOut();
                          } else if (value == 'language') {
                            _showLanguagePicker(context);
                          }
                        },
                        itemBuilder: (ctx) => [
                          PopupMenuItem<String>(
                            value: 'language',
                            child: Row(
                              children: [
                                const Icon(Icons.language_rounded, size: 20),
                                const SizedBox(width: 8),
                                Text(AppLocalizations.of(ctx)!.languageLabel),
                              ],
                            ),
                          ),
                          PopupMenuItem<String>(
                            value: 'logout',
                            child: Row(
                              children: [
                                const Icon(Icons.logout_rounded, size: 20),
                                const SizedBox(width: 8),
                                Text(AppLocalizations.of(ctx)!.signOut),
                              ],
                            ),
                          ),
                        ],
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(
                            Icons.more_horiz_rounded,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Expanded(
              child: IndexedStack(index: _currentIndex, children: screens),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          MediaQuery.of(context).padding.bottom == 0
              ? 14
              : MediaQuery.of(context).padding.bottom,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.90),
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: AppColors.inverseSurface.withValues(alpha: 0.10),
                blurRadius: 26,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Row(
            children: [
              _NavButton(
                icon: Icons.home_rounded,
                label: AppLocalizations.of(context)!.navHome,
                selected: _currentIndex == 0,
                onTap: () => setState(() => _currentIndex = 0),
              ),
              _NavButton(
                icon: Icons.explore_rounded,
                label: AppLocalizations.of(context)!.navMap,
                selected: _currentIndex == 1,
                onTap: () => setState(() => _currentIndex = 1),
              ),
              _NavButton(
                icon: Icons.emergency_rounded,
                label: AppLocalizations.of(context)!.navSos,
                selected: _currentIndex == 2,
                onTap: () => setState(() => _currentIndex = 2),
              ),
              _NavButton(
                icon: Icons.inventory_2_rounded,
                label: AppLocalizations.of(context)!.navResources,
                selected: _currentIndex == 3,
                onTap: () => setState(() => _currentIndex = 3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: selected ? Colors.white : AppColors.outline),
              const SizedBox(height: 4),
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected ? Colors.white : AppColors.outline,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.flag,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String flag;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary.withValues(alpha: 0.08)
              : AppColors.surfaceLowest,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? AppColors.primary : Colors.grey.shade200,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Text(flag, style: const TextStyle(fontSize: 28)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: selected ? AppColors.primary : null,
                        ),
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.outline,
                        ),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle_rounded,
                  color: AppColors.primary, size: 24),
          ],
        ),
      ),
    );
  }
}
