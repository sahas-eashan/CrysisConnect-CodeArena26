import 'dart:async';

import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:flutter/material.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.repository,
    required this.userId,
  });

  final CitizenRepository repository;
  final String userId;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<DashboardBundle> _future;
  final List<NewsUpdate> _liveNews = [];
  StreamSubscription<NewsUpdate>? _newsSubscription;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadDashboard();
    _newsSubscription = widget.repository.subscribeToNews().listen((update) {
      if (!mounted) return;
      setState(() {
        _liveNews.removeWhere((item) => item.id == update.id);
        _liveNews.insert(0, update);
      });
    });
  }

  @override
  void dispose() {
    _newsSubscription?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.repository.loadDashboard();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<DashboardBundle>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return _ErrorView(
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          final bundle = snapshot.data!;
          final news = [..._liveNews, ...bundle.news]
            ..sort((a, b) => (b.createdAt ?? '').compareTo(a.createdAt ?? ''));
          final primaryDisaster = bundle.disasters.isEmpty
              ? null
              : bundle.disasters.first;
          final safeZone =
              bundle.nearestSafeZone ??
              (bundle.safeZones.isEmpty ? null : bundle.safeZones.first);

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 140),
            children: [
              if (primaryDisaster != null)
                _EmergencyBanner(disaster: primaryDisaster)
              else
                const _EmptyBanner(
                  title: 'No active disaster alerts',
                  message:
                      'This citizen app is now connected to the live backend. Pull to refresh for new incidents.',
                ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Active disasters',
                      value: bundle.stats.activeDisasters.toString(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatCard(
                      label: 'Safe zones',
                      value: bundle.stats.totalSafeZones.toString(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatCard(
                      label: 'Resources',
                      value: bundle.stats.totalResources.toString(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (safeZone != null) _SafeZoneCard(zone: safeZone),
              const SizedBox(height: 22),
              _SectionHeader(
                title: 'Active Disasters',
                subtitle: 'Fetched from AppSync / PostGIS',
              ),
              const SizedBox(height: 12),
              if (bundle.disasters.isEmpty)
                const _EmptyTile(
                  message: 'No active disaster records were returned.',
                )
              else
                ...bundle.disasters.map(
                  (disaster) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _DisasterTile(disaster: disaster),
                  ),
                ),
              const SizedBox(height: 18),
              _SectionHeader(
                title: 'Live Crisis Updates',
                subtitle: 'Realtime news stream',
              ),
              const SizedBox(height: 12),
              if (news.isEmpty)
                const _EmptyTile(
                  message: 'No published updates are available yet.',
                )
              else
                ...news
                    .take(4)
                    .map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _NewsCard(item: item),
                      ),
                    ),
            ],
          );
        },
      ),
    );
  }
}

class _EmergencyBanner extends StatelessWidget {
  const _EmergencyBanner({required this.disaster});

  final Disaster disaster;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.secondary,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
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
              children: [
                Text(
                  disaster.title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  disaster.description ??
                      'A live disaster warning is active in your area.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.88),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Pill(
                      label: disaster.severity,
                      color: Colors.white.withValues(alpha: 0.18),
                      textColor: Colors.white,
                    ),
                    _Pill(
                      label: disaster.status,
                      color: Colors.white.withValues(alpha: 0.18),
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

class _SafeZoneCard extends StatelessWidget {
  const _SafeZoneCard({required this.zone});

  final SafeZone zone;

  @override
  Widget build(BuildContext context) {
    final percent = (zone.occupancyRate * 100).clamp(0, 100).toDouble();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Pill(
            label: 'Recommended route',
            color: AppColors.tertiaryContainer,
            textColor: AppColors.onTertiaryContainer,
          ),
          const SizedBox(height: 12),
          Text(
            zone.name,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Capacity ${zone.currentOccupancy}/${zone.capacity}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.surfaceVariantText,
            ),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 10,
              value: zone.capacity == 0
                  ? 0
                  : zone.currentOccupancy / zone.capacity,
              color: AppColors.primary,
              backgroundColor: AppColors.surfaceHigh,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '${percent.toStringAsFixed(0)}% occupied',
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: AppColors.outline),
          ),
          if (zone.amenities.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: zone.amenities
                  .map(
                    (item) => _Pill(
                      label: item,
                      color: AppColors.surfaceLow,
                      textColor: AppColors.onSurface,
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _DisasterTile extends StatelessWidget {
  const _DisasterTile({required this.disaster});

  final Disaster disaster;

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
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: _severityColor(disaster.severity).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.warning_amber_rounded,
              color: _severityColor(disaster.severity),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  disaster.title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  disaster.description ?? disaster.type,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.surfaceVariantText,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          _Pill(
            label: disaster.severity,
            color: _severityColor(disaster.severity),
            textColor: Colors.white,
          ),
        ],
      ),
    );
  }

  Color _severityColor(String severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return AppColors.secondary;
      case 'high':
        return AppColors.primary;
      default:
        return AppColors.outline;
    }
  }
}

class _NewsCard extends StatelessWidget {
  const _NewsCard({required this.item});

  final NewsUpdate item;

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
          if (item.category != null)
            _Pill(
              label: item.category!,
              color: AppColors.surfaceLow,
              textColor: AppColors.primary,
            ),
          if (item.category != null) const SizedBox(height: 10),
          Text(
            item.title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            item.content,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.surfaceVariantText,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
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

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: AppColors.outline),
        ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
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
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

class _EmptyBanner extends StatelessWidget {
  const _EmptyBanner({required this.title, required this.message});

  final String title;
  final String message;

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
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(message),
        ],
      ),
    );
  }
}

class _EmptyTile extends StatelessWidget {
  const _EmptyTile({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Text(message),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 120),
        const Icon(Icons.cloud_off_rounded, color: AppColors.error, size: 64),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        FilledButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    );
  }
}
