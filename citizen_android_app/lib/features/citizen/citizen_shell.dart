import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/features/citizen/dashboard_screen.dart';
import 'package:crisisconnect_citizen/features/citizen/map_screen.dart';
import 'package:crisisconnect_citizen/features/citizen/resources_screen.dart';
import 'package:crisisconnect_citizen/features/citizen/sos_screen.dart';
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
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLowest,
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
                            widget.session.username ?? 'Citizen access',
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
                        }
                      },
                      itemBuilder: (context) => const [
                        PopupMenuItem<String>(
                          value: 'logout',
                          child: Text('Sign out'),
                        ),
                      ],
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLowest,
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
                label: 'Home',
                selected: _currentIndex == 0,
                onTap: () => setState(() => _currentIndex = 0),
              ),
              _NavButton(
                icon: Icons.explore_rounded,
                label: 'Map',
                selected: _currentIndex == 1,
                onTap: () => setState(() => _currentIndex = 1),
              ),
              _NavButton(
                icon: Icons.emergency_rounded,
                label: 'SOS',
                selected: _currentIndex == 2,
                onTap: () => setState(() => _currentIndex = 2),
              ),
              _NavButton(
                icon: Icons.inventory_2_rounded,
                label: 'Resources',
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
