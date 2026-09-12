import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  runApp(const CrisisConnectApp());
}

class CrisisConnectApp extends StatelessWidget {
  const CrisisConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    final textTheme = GoogleFonts.interTextTheme().apply(
      bodyColor: AppColors.onSurface,
      displayColor: AppColors.onSurface,
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'CrisisConnect Citizen',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.background,
        colorScheme: const ColorScheme.light(
          primary: AppColors.primary,
          secondary: AppColors.secondary,
          surface: AppColors.surfaceLowest,
          error: AppColors.error,
          onPrimary: AppColors.onPrimary,
          onSecondary: AppColors.onPrimary,
          onSurface: AppColors.onSurface,
          onError: Colors.white,
        ),
        textTheme: textTheme,
        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppColors.inverseSurface,
          contentTextStyle: textTheme.bodyMedium?.copyWith(color: Colors.white),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surfaceHigh,
          hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.outline),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 18,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.4),
          ),
        ),
      ),
      home: const CitizenShell(),
    );
  }
}

class CitizenShell extends StatefulWidget {
  const CitizenShell({super.key});

  @override
  State<CitizenShell> createState() => _CitizenShellState();
}

class _CitizenShellState extends State<CitizenShell> {
  int _currentIndex = 0;
  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = const [
      DashboardScreen(),
      SafetyMapScreen(),
      SosScreen(),
      ResourcesScreen(),
    ];
  }

  @override
  Widget build(BuildContext context) {
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
        child: IndexedStack(index: _currentIndex, children: _screens),
      ),
      bottomNavigationBar: CitizenBottomNav(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
      ),
    );
  }
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 136),
        children: [
          CrisisHeader(),
          SizedBox(height: 20),
          EmergencyBanner(),
          SizedBox(height: 16),
          QuickStatsRow(),
          SizedBox(height: 20),
          SafeRouteCard(),
          SizedBox(height: 24),
          SectionHeader(title: 'Active Disasters', actionLabel: 'View Map'),
          SizedBox(height: 12),
          DisasterTile(data: disasterItems[0]),
          SizedBox(height: 10),
          DisasterTile(data: disasterItems[1]),
          SizedBox(height: 10),
          DisasterTile(data: disasterItems[2]),
          SizedBox(height: 24),
          SectionHeader(title: 'Crisis Updates'),
          SizedBox(height: 12),
          FeaturedUpdateCard(data: updateItems[0]),
          SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: MiniUpdateCard(data: updateItems[1])),
              SizedBox(width: 12),
              Expanded(child: MiniUpdateCard(data: updateItems[2])),
            ],
          ),
        ],
      ),
    );
  }
}

class SafetyMapScreen extends StatelessWidget {
  const SafetyMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = constraints.maxHeight;

        return Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: MapBackdropPainter())),
            Positioned(
              top: height * 0.20,
              left: width * 0.26,
              child: Container(
                width: width * 0.42,
                height: width * 0.42,
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.18),
                  border: Border.all(color: AppColors.secondary, width: 2),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Center(
                  child: Icon(
                    Icons.warning_rounded,
                    color: AppColors.secondary,
                    size: 42,
                  ),
                ),
              ),
            ),
            Positioned(
              top: height * 0.58,
              left: width * 0.18,
              child: const MapMarker(
                icon: Icons.home_rounded,
                color: AppColors.tertiary,
                label: 'Evac Center A',
              ),
            ),
            Positioned(
              top: height * 0.42,
              right: width * 0.18,
              child: const MapMarker(
                icon: Icons.inventory_2_rounded,
                color: AppColors.primary,
                label: 'Water Supply',
              ),
            ),
            Positioned(
              top: height * 0.34,
              right: width * 0.34,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.secondary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.secondary.withValues(alpha: 0.28),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.local_fire_department_rounded,
                  color: Colors.white,
                ),
              ),
            ),
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    FilterChipsRow(),
                    SizedBox(height: 12),
                    TacticalSearchBar(),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 24,
              right: 24,
              bottom: 208,
              child: const FilledActionButton(
                icon: Icons.emergency_rounded,
                label: 'Get Me to Safety',
                color: AppColors.secondary,
              ),
            ),
            const Positioned(
              left: 20,
              right: 20,
              bottom: 102,
              child: SafeZoneBottomSheet(),
            ),
          ],
        );
      },
    );
  }
}

class SosScreen extends StatefulWidget {
  const SosScreen({super.key});

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> {
  EmergencyType _selectedType = emergencyTypes.first;
  bool _sosSent = false;

  void _sendSos() {
    setState(() => _sosSent = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'SOS sent for ${_selectedType.label.toLowerCase()}. Nearby responders have been alerted.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 136),
        children: [
          const CrisisHeader(),
          const SizedBox(height: 20),
          const LocationStatusPill(),
          const SizedBox(height: 28),
          Center(
            child: Column(
              children: [
                Text(
                  'Press and hold for 3 seconds',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.outline,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 20),
                HoldToSendButton(onLongPress: _sendSos),
                const SizedBox(height: 20),
                SizedBox(
                  width: 280,
                  child: Text(
                    'Emergency services and trusted contacts will receive your live location immediately.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.surfaceVariantText,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 34),
          Text(
            'Select Emergency Type',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.surfaceVariantText,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.8,
            ),
          ),
          const SizedBox(height: 14),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: emergencyTypes.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.18,
            ),
            itemBuilder: (context, index) {
              final type = emergencyTypes[index];
              return EmergencyTypeCard(
                type: type,
                isSelected: _selectedType == type,
                onTap: () => setState(() => _selectedType = type),
              );
            },
          ),
          const SizedBox(height: 18),
          AnimatedOpacity(
            duration: const Duration(milliseconds: 180),
            opacity: _sosSent ? 1 : 0.72,
            child: ResponderCard(active: _sosSent),
          ),
        ],
      ),
    );
  }
}

class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({super.key});

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  String _query = '';
  String _selectedCategory = 'All';

  List<ResourceItem> get _filteredResources {
    return resourceItems.where((resource) {
      final matchesCategory =
          _selectedCategory == 'All' || resource.category == _selectedCategory;
      final matchesQuery =
          _query.isEmpty ||
          resource.name.toLowerCase().contains(_query.toLowerCase()) ||
          resource.provider.toLowerCase().contains(_query.toLowerCase());
      return matchesCategory && matchesQuery;
    }).toList();
  }

  void _requestResource(ResourceItem resource) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${resource.name} request has been queued for NGO review.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 136),
        children: [
          const CrisisHeader(),
          const SizedBox(height: 20),
          TextField(
            onChanged: (value) => setState(() => _query = value),
            decoration: const InputDecoration(
              hintText: 'Search food, water, medicine...',
              prefixIcon: Icon(Icons.search_rounded, color: AppColors.outline),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 42,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) {
                final category = resourceCategories[index];
                final selected = _selectedCategory == category;
                return FilterChip(
                  label: Text(category),
                  selected: selected,
                  onSelected: (_) =>
                      setState(() => _selectedCategory = category),
                  backgroundColor: AppColors.surfaceHighest,
                  selectedColor: AppColors.primary,
                  labelStyle: TextStyle(
                    color: selected ? Colors.white : AppColors.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                  side: BorderSide.none,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  showCheckmark: false,
                );
              },
              separatorBuilder: (_, separatorIndex) => const SizedBox(width: 8),
              itemCount: resourceCategories.length,
            ),
          ),
          const SizedBox(height: 18),
          ..._filteredResources.map(
            (resource) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: ResourceCard(
                item: resource,
                onRequest: () => _requestResource(resource),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'My Active Requests',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          ActiveRequestTile(data: activeRequests[0]),
          const SizedBox(height: 10),
          ActiveRequestTile(data: activeRequests[1]),
        ],
      ),
    );
  }
}

class CrisisHeader extends StatelessWidget {
  const CrisisHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppColors.surfaceLowest,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: const Icon(Icons.shield_rounded, color: AppColors.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            'CrisisConnect',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.surfaceLow,
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(
            Icons.notifications_none_rounded,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class EmergencyBanner extends StatelessWidget {
  const EmergencyBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.secondary,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.secondary.withValues(alpha: 0.22),
            blurRadius: 30,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.warning_amber_rounded, color: Colors.white),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Heavy Rain & Landslide Warning',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Colombo District • Immediate action required',
                  style: TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatusPill(
                      label: 'Critical',
                      color: Color(0x33FFFFFF),
                      textColor: Colors.white,
                    ),
                    StatusPill(
                      label: 'Active Now',
                      color: Color(0x33FFFFFF),
                      textColor: Colors.white,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class QuickStatsRow extends StatelessWidget {
  const QuickStatsRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: const [
        Expanded(
          child: StatChip(value: '03', label: 'Active Alerts'),
        ),
        SizedBox(width: 10),
        Expanded(
          child: StatChip(value: '12', label: 'Safe Zones'),
        ),
        SizedBox(width: 10),
        Expanded(
          child: StatChip(value: '18', label: 'Responders'),
        ),
      ],
    );
  }
}

class StatChip extends StatelessWidget {
  const StatChip({super.key, required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.outline,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class SafeRouteCard extends StatelessWidget {
  const SafeRouteCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.1),
            blurRadius: 32,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const StatusPill(
            label: 'Recommended Route',
            color: AppColors.tertiaryContainer,
            textColor: AppColors.onTertiaryContainer,
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  'Nearest Safe Zone',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text.rich(
                const TextSpan(
                  children: [
                    TextSpan(
                      text: '1.2',
                      style: TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    TextSpan(
                      text: ' km',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                style: const TextStyle(color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Row(
              children: [
                Icon(Icons.location_on_rounded, color: AppColors.tertiary),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Location',
                        style: TextStyle(
                          color: AppColors.outline,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Viharamahadevi Park Grounds',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const FilledActionButton(
            icon: Icons.directions_run_rounded,
            label: 'Get Me to Safety',
          ),
        ],
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.actionLabel});

  final String title;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        if (actionLabel != null)
          Text(
            actionLabel!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
      ],
    );
  }
}

class DisasterTile extends StatelessWidget {
  const DisasterTile({super.key, required this.data});

  final DisasterInfo data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: data.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(data.icon, color: data.accent),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${data.location} • ${data.time}',
                  style: TextStyle(
                    color: AppColors.surfaceVariantText.withValues(alpha: 0.9),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          StatusPill(
            label: data.severity,
            color: data.severity == 'Critical'
                ? AppColors.secondary
                : AppColors.surfaceHighest,
            textColor: data.severity == 'Critical'
                ? Colors.white
                : AppColors.onSurface,
          ),
        ],
      ),
    );
  }
}

class FeaturedUpdateCard extends StatelessWidget {
  const FeaturedUpdateCard({super.key, required this.data});

  final UpdateItem data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: AppColors.primaryFixed,
                child: Icon(data.icon, size: 16, color: data.color),
              ),
              const SizedBox(width: 8),
              Text(
                data.source,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.outline,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            data.title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            data.detail,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.surfaceVariantText,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            data.badge,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class MiniUpdateCard extends StatelessWidget {
  const MiniUpdateCard({super.key, required this.data});

  final UpdateItem data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(data.icon, color: data.color),
          const SizedBox(height: 10),
          Text(
            data.title,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            data.badge,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: data.color,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class FilterChipsRow extends StatelessWidget {
  const FilterChipsRow({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: const [
          CompactChip(label: 'All', active: true),
          SizedBox(width: 8),
          CompactChip(label: 'Safe Zones'),
          SizedBox(width: 8),
          CompactChip(label: 'Disasters'),
          SizedBox(width: 8),
          CompactChip(label: 'Resources'),
        ],
      ),
    );
  }
}

class TacticalSearchBar extends StatelessWidget {
  const TacticalSearchBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.84),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: AppColors.inverseSurface.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Row(
        children: [
          Icon(Icons.search_rounded, color: AppColors.outline),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Search safety zones or depots...',
              style: TextStyle(
                color: AppColors.outline,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Icon(Icons.my_location_rounded, color: AppColors.primary),
        ],
      ),
    );
  }
}

class MapMarker extends StatelessWidget {
  const MapMarker({
    super.key,
    required this.icon,
    required this.color,
    required this.label,
  });

  final IconData icon;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.24),
                blurRadius: 22,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.86),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: AppColors.inverseSurface,
            ),
          ),
        ),
      ],
    );
  }
}

class SafeZoneBottomSheet extends StatelessWidget {
  const SafeZoneBottomSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppColors.inverseSurface.withValues(alpha: 0.12),
            blurRadius: 30,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const StatusPill(
            label: 'Active Safe Zone',
            color: AppColors.tertiaryContainer,
            textColor: AppColors.onTertiaryContainer,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Lincoln High Shelter',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '1.2 miles away • 15 min walk',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.surfaceHigh,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.directions_rounded,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Row(
            children: [
              Expanded(
                child: AmenityCard(
                  icon: Icons.medical_services_rounded,
                  label: 'Medical',
                  color: AppColors.primary,
                ),
              ),
              SizedBox(width: 10),
              Expanded(
                child: AmenityCard(
                  icon: Icons.restaurant_rounded,
                  label: 'Food/Water',
                  color: AppColors.tertiary,
                ),
              ),
              SizedBox(width: 10),
              Expanded(
                child: AmenityCard(
                  icon: Icons.battery_charging_full_rounded,
                  label: 'Power',
                  color: AppColors.secondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.tertiary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: AppColors.tertiary,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  'Capacity: 450 / 800 berths available',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.onTertiaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AmenityCard extends StatelessWidget {
  const AmenityCard({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.outline,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class LocationStatusPill extends StatelessWidget {
  const LocationStatusPill({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.location_on_rounded, size: 18, color: AppColors.tertiary),
          SizedBox(width: 8),
          Text(
            'Location captured (Colombo 07)',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          SizedBox(width: 8),
          _SignalDot(color: AppColors.tertiary),
        ],
      ),
    );
  }
}

class HoldToSendButton extends StatelessWidget {
  const HoldToSendButton({super.key, required this.onLongPress});

  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onLongPress,
      child: SizedBox(
        width: 292,
        height: 292,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              width: 286,
              height: 286,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.secondary.withValues(alpha: 0.12),
                  width: 2,
                ),
              ),
            ),
            Container(
              width: 252,
              height: 252,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.secondary.withValues(alpha: 0.18),
                  width: 2,
                ),
              ),
            ),
            Container(
              width: 228,
              height: 228,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.secondary, AppColors.secondaryContainer],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.secondary.withValues(alpha: 0.24),
                    blurRadius: 42,
                    offset: const Offset(0, 18),
                  ),
                ],
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.emergency_share_rounded,
                    size: 62,
                    color: Colors.white,
                  ),
                  SizedBox(height: 10),
                  Text(
                    'SEND SOS',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class EmergencyTypeCard extends StatelessWidget {
  const EmergencyTypeCard({
    super.key,
    required this.type,
    required this.isSelected,
    required this.onTap,
  });

  final EmergencyType type;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? AppColors.primaryFixed : AppColors.surfaceLowest,
      borderRadius: BorderRadius.circular(28),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(type.icon, color: type.color, size: 34),
            const SizedBox(height: 8),
            Text(
              type.label,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

class ResponderCard extends StatelessWidget {
  const ResponderCard({super.key, required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceHighest,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primaryFixed, AppColors.surfaceHigh],
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.person_rounded, color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  active ? 'Help is on the way' : 'Ready to alert responders',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  active
                      ? 'Officer Miller'
                      : 'Nearest emergency team will be assigned',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  active
                      ? 'ETA: 4 minutes'
                      : 'Live status appears here after confirmation',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: AppColors.outline),
                ),
              ],
            ),
          ),
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.call_rounded, color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class ResourceCard extends StatelessWidget {
  const ResourceCard({super.key, required this.item, required this.onRequest});

  final ResourceItem item;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 148,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  item.color.withValues(alpha: 0.18),
                  AppColors.surfaceLow,
                ],
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(30),
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  top: -20,
                  right: -10,
                  child: Icon(
                    item.icon,
                    size: 120,
                    color: item.color.withValues(alpha: 0.10),
                  ),
                ),
                Positioned(
                  top: 16,
                  left: 16,
                  child: StatusPill(
                    label: item.status,
                    color: item.statusColor,
                    textColor: item.statusTextColor,
                  ),
                ),
                Positioned(
                  left: 20,
                  bottom: 18,
                  child: Icon(item.icon, size: 42, color: item.color),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      item.distance,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  item.quantityLabel,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.surfaceVariantText,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceHighest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        item.providerIcon,
                        size: 18,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        item.provider,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.outline,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    FilledButton(
                      onPressed: onRequest,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Text('Request'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ActiveRequestTile extends StatelessWidget {
  const ActiveRequestTile({super.key, required this.data});

  final RequestItem data;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: data.tint.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(data.icon, color: data.tint),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.name,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  data.status,
                  style: TextStyle(
                    color: data.tint,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.outline),
        ],
      ),
    );
  }
}

class CitizenBottomNav extends StatelessWidget {
  const CitizenBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, math.max(12, bottomInset)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.88),
          borderRadius: BorderRadius.circular(30),
          boxShadow: [
            BoxShadow(
              color: AppColors.inverseSurface.withValues(alpha: 0.10),
              blurRadius: 28,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Row(
          children: [
            _BottomNavButton(
              index: 0,
              currentIndex: currentIndex,
              icon: Icons.home_rounded,
              label: 'Home',
              onTap: onTap,
            ),
            _BottomNavButton(
              index: 1,
              currentIndex: currentIndex,
              icon: Icons.explore_rounded,
              label: 'Map',
              onTap: onTap,
            ),
            _BottomNavButton(
              index: 2,
              currentIndex: currentIndex,
              icon: Icons.emergency_rounded,
              label: 'SOS',
              onTap: onTap,
            ),
            _BottomNavButton(
              index: 3,
              currentIndex: currentIndex,
              icon: Icons.inventory_2_rounded,
              label: 'Resources',
              onTap: onTap,
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomNavButton extends StatelessWidget {
  const _BottomNavButton({
    required this.index,
    required this.currentIndex,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final int index;
  final int currentIndex;
  final IconData icon;
  final String label;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final active = currentIndex == index;

    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? AppColors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: active ? Colors.white : AppColors.outline),
              const SizedBox(height: 4),
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: active ? Colors.white : AppColors.outline,
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

class FilledActionButton extends StatelessWidget {
  const FilledActionButton({
    super.key,
    required this.icon,
    required this.label,
    this.color = AppColors.primary,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, Color.lerp(color, Colors.white, 0.14)!],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.26),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () {},
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 17),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.white),
                const SizedBox(width: 10),
                Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CompactChip extends StatelessWidget {
  const CompactChip({super.key, required this.label, this.active = false});

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: BoxDecoration(
        color: active
            ? AppColors.primary
            : Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? Colors.white : AppColors.onSurface,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    required this.color,
    required this.textColor,
  });

  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: textColor,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _SignalDot extends StatelessWidget {
  const _SignalDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 9,
      height: 9,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class MapBackdropPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final background = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFE7F3FA), Color(0xFFD7E8F0)],
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, background);

    final terrainPaint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    for (var i = 0; i < 8; i++) {
      final path = Path();
      final startY = size.height * (0.08 + i * 0.11);
      path.moveTo(0, startY);
      path.cubicTo(
        size.width * 0.25,
        startY - 26,
        size.width * 0.55,
        startY + 18,
        size.width,
        startY - 12,
      );
      canvas.drawPath(path, terrainPaint);
    }

    final riverPaint = Paint()
      ..color = AppColors.primary.withValues(alpha: 0.10)
      ..strokeWidth = 16
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final river = Path()
      ..moveTo(size.width * 0.05, size.height * 0.18)
      ..cubicTo(
        size.width * 0.22,
        size.height * 0.25,
        size.width * 0.40,
        size.height * 0.40,
        size.width * 0.30,
        size.height * 0.70,
      )
      ..cubicTo(
        size.width * 0.26,
        size.height * 0.80,
        size.width * 0.18,
        size.height * 0.90,
        size.width * 0.10,
        size.height,
      );
    canvas.drawPath(river, riverPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class AppColors {
  static const primary = Color(0xFF005EA4);
  static const primaryContainer = Color(0xFF0077CE);
  static const primaryFixed = Color(0xFFD3E4FF);
  static const secondary = Color(0xFFB7131A);
  static const secondaryContainer = Color(0xFFDB322F);
  static const tertiary = Color(0xFF006B1B);
  static const tertiaryContainer = Color(0xFF98F994);
  static const onTertiaryContainer = Color(0xFF002204);
  static const background = Color(0xFFF4FAFF);
  static const surfaceLow = Color(0xFFE9F6FD);
  static const surfaceHigh = Color(0xFFDDEAF2);
  static const surfaceHighest = Color(0xFFD7E4EC);
  static const surfaceLowest = Color(0xFFFFFFFF);
  static const surfaceVariantText = Color(0xFF404752);
  static const outline = Color(0xFF707783);
  static const inverseSurface = Color(0xFF263238);
  static const onSurface = Color(0xFF111D23);
  static const onPrimary = Color(0xFFFFFFFF);
  static const error = Color(0xFFBA1A1A);
}

class DisasterInfo {
  const DisasterInfo({
    required this.title,
    required this.location,
    required this.time,
    required this.severity,
    required this.icon,
    required this.accent,
  });

  final String title;
  final String location;
  final String time;
  final String severity;
  final IconData icon;
  final Color accent;
}

class UpdateItem {
  const UpdateItem({
    required this.source,
    required this.title,
    required this.detail,
    required this.badge,
    required this.icon,
    required this.color,
  });

  final String source;
  final String title;
  final String detail;
  final String badge;
  final IconData icon;
  final Color color;
}

class EmergencyType {
  const EmergencyType({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;
}

class ResourceItem {
  const ResourceItem({
    required this.name,
    required this.category,
    required this.distance,
    required this.quantityLabel,
    required this.provider,
    required this.providerIcon,
    required this.status,
    required this.statusColor,
    required this.statusTextColor,
    required this.icon,
    required this.color,
  });

  final String name;
  final String category;
  final String distance;
  final String quantityLabel;
  final String provider;
  final IconData providerIcon;
  final String status;
  final Color statusColor;
  final Color statusTextColor;
  final IconData icon;
  final Color color;
}

class RequestItem {
  const RequestItem({
    required this.name,
    required this.status,
    required this.icon,
    required this.tint,
  });

  final String name;
  final String status;
  final IconData icon;
  final Color tint;
}

const disasterItems = [
  DisasterInfo(
    title: 'Major Flooding',
    location: 'Kelani River Basin',
    time: '2h ago',
    severity: 'Critical',
    icon: Icons.water_damage_rounded,
    accent: AppColors.secondary,
  ),
  DisasterInfo(
    title: 'Minor Landslide',
    location: 'Kandy - Hatton Rd',
    time: '5h ago',
    severity: 'High',
    icon: Icons.landscape_rounded,
    accent: AppColors.primary,
  ),
  DisasterInfo(
    title: 'Storm Surge',
    location: 'Negombo Coastal',
    time: '8h ago',
    severity: 'Medium',
    icon: Icons.cyclone_rounded,
    accent: AppColors.tertiary,
  ),
];

const updateItems = [
  UpdateItem(
    source: 'DMC Sri Lanka',
    title: 'Emergency rations distribution started at Maligawatta Center.',
    detail:
        'Food kits, medicine and safe drinking water are now available for affected families.',
    badge: '15 mins ago',
    icon: Icons.verified_user_rounded,
    color: AppColors.primary,
  ),
  UpdateItem(
    source: 'Red Cross',
    title: 'Volunteers needed',
    detail: '',
    badge: 'Active request',
    icon: Icons.volunteer_activism_rounded,
    color: AppColors.tertiary,
  ),
  UpdateItem(
    source: 'Met Dept',
    title: 'Rainfall to persist',
    detail: '',
    badge: 'Weather advisory',
    icon: Icons.cloud_rounded,
    color: AppColors.outline,
  ),
];

const emergencyTypes = [
  EmergencyType(
    label: 'Medical',
    icon: Icons.medical_services_rounded,
    color: AppColors.secondary,
  ),
  EmergencyType(
    label: 'Trapped',
    icon: Icons.door_front_door_outlined,
    color: AppColors.primary,
  ),
  EmergencyType(
    label: 'Evacuation',
    icon: Icons.directions_run_rounded,
    color: AppColors.tertiary,
  ),
  EmergencyType(
    label: 'Resources',
    icon: Icons.inventory_2_rounded,
    color: AppColors.inverseSurface,
  ),
];

const resourceCategories = ['All', 'Food', 'Water', 'Medical', 'Shelter'];

const resourceItems = [
  ResourceItem(
    name: 'Emergency Ration Packs',
    category: 'Food',
    distance: '0.8 km',
    quantityLabel: '450 units remaining',
    provider: 'Red Cross',
    providerIcon: Icons.corporate_fare_rounded,
    status: 'Available',
    statusColor: AppColors.tertiaryContainer,
    statusTextColor: AppColors.onTertiaryContainer,
    icon: Icons.inventory_2_rounded,
    color: AppColors.primary,
  ),
  ResourceItem(
    name: 'Potable Water (5L)',
    category: 'Water',
    distance: '2.4 km',
    quantityLabel: '12 units remaining',
    provider: 'Local Guard',
    providerIcon: Icons.health_and_safety_rounded,
    status: 'Low Stock',
    statusColor: Color(0xFFFFDAD6),
    statusTextColor: Color(0xFF93000A),
    icon: Icons.water_drop_rounded,
    color: AppColors.primaryContainer,
  ),
  ResourceItem(
    name: 'First Aid Trauma Kits',
    category: 'Medical',
    distance: '1.1 km',
    quantityLabel: '80 kits available',
    provider: 'Doctors Without Borders',
    providerIcon: Icons.medical_information_rounded,
    status: 'Available',
    statusColor: AppColors.tertiaryContainer,
    statusTextColor: AppColors.onTertiaryContainer,
    icon: Icons.medical_services_rounded,
    color: AppColors.secondary,
  ),
];

const activeRequests = [
  RequestItem(
    name: 'Insulin Supplies',
    status: 'Requested 2h ago • Pending approval',
    icon: Icons.medication_rounded,
    tint: AppColors.primary,
  ),
  RequestItem(
    name: 'Thermal Blankets (x2)',
    status: 'Ready for pickup at Station A',
    icon: Icons.check_circle_rounded,
    tint: AppColors.tertiary,
  ),
];
