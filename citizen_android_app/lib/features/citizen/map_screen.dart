import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.repository});

  final CitizenRepository repository;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late Future<MapBundle> _future;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadMapData();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.repository.loadMapData();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MapBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: FilledButton(
                onPressed: _refresh,
                child: Text('${AppLocalizations.of(context)!.retryMapLoad}\n${snapshot.error}'),
              ),
            ),
          );
        }

        final bundle = snapshot.data!;
        final center =
            bundle.currentLocation ??
            bundle.nearestSafeZone?.locationPoint?.latLng ??
            bundle.safeZones.firstOrNull?.locationPoint?.latLng ??
            bundle.disasters.firstOrNull?.mapCenter ??
            const LatLng(6.9271, 79.8612);

        final disasterPolygons = bundle.disasters
            .map((item) => item.affectedAreaPolygon)
            .whereType<GeoJsonPolygon>()
            .map(
              (polygon) => Polygon(
                points: polygon.points,
                color: AppColors.secondary.withValues(alpha: 0.16),
                borderColor: AppColors.secondary,
                borderStrokeWidth: 2,
              ),
            )
            .toList();

        final safeZonePolygons = bundle.safeZones
            .map((item) => item.boundaryPolygon)
            .whereType<GeoJsonPolygon>()
            .map(
              (polygon) => Polygon(
                points: polygon.points,
                color: AppColors.tertiary.withValues(alpha: 0.10),
                borderColor: AppColors.tertiary,
                borderStrokeWidth: 2,
              ),
            )
            .toList();

        final markers = <Marker>[
          if (_filter == 'all' || _filter == 'safeZones')
            ...bundle.safeZones
                .where((zone) => zone.locationPoint != null)
                .map(
                  (zone) => Marker(
                    point: zone.locationPoint!.latLng,
                    width: 88,
                    height: 70,
                    child: _MapMarker(
                      color: AppColors.tertiary,
                      icon: Icons.home_rounded,
                      label: zone.name,
                    ),
                  ),
                ),
          if (_filter == 'all' || _filter == 'resources')
            ...bundle.resources
                .where((resource) => resource.locationPoint != null)
                .map(
                  (resource) => Marker(
                    point: resource.locationPoint!.latLng,
                    width: 90,
                    height: 70,
                    child: _MapMarker(
                      color: AppColors.primary,
                      icon: Icons.inventory_2_rounded,
                      label: resource.name,
                    ),
                  ),
                ),
          if (bundle.currentLocation != null)
            Marker(
              point: bundle.currentLocation!,
              width: 28,
              height: 28,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
              ),
            ),
        ];

        return RefreshIndicator(
          onRefresh: _refresh,
          child: Stack(
            children: [
              FlutterMap(
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: 12,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.all,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.crisisconnect.citizen',
                  ),
                  if ((_filter == 'all' || _filter == 'disasters') &&
                      disasterPolygons.isNotEmpty)
                    PolygonLayer(polygons: disasterPolygons),
                  if ((_filter == 'all' || _filter == 'safeZones') &&
                      safeZonePolygons.isNotEmpty)
                    PolygonLayer(polygons: safeZonePolygons),
                  MarkerLayer(markers: markers),
                  const RichAttributionWidget(
                    attributions: [
                      TextSourceAttribution('OpenStreetMap contributors'),
                    ],
                  ),
                ],
              ),
              SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _FilterChip(
                              label: AppLocalizations.of(context)!.filterAll,
                              active: _filter == 'all',
                              onTap: () => setState(() => _filter = 'all'),
                            ),
                            _FilterChip(
                              label: AppLocalizations.of(context)!.filterSafeZones,
                              active: _filter == 'safeZones',
                              onTap: () =>
                                  setState(() => _filter = 'safeZones'),
                            ),
                            _FilterChip(
                              label: AppLocalizations.of(context)!.filterDisasters,
                              active: _filter == 'disasters',
                              onTap: () =>
                                  setState(() => _filter = 'disasters'),
                            ),
                            _FilterChip(
                              label: AppLocalizations.of(context)!.filterResources,
                              active: _filter == 'resources',
                              onTap: () =>
                                  setState(() => _filter = 'resources'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.88),
                          borderRadius: BorderRadius.circular(30),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.map_outlined, color: AppColors.outline),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                AppLocalizations.of(context)!.liveMapBanner,
                                style: const TextStyle(color: AppColors.outline),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 24,
                right: 24,
                bottom: 194,
                child: FilledButton.icon(
                  onPressed: _refresh,
                  icon: const Icon(Icons.my_location_rounded),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.secondary,
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                  label: Text(AppLocalizations.of(context)!.getMeToSafety),
                ),
              ),
              if (bundle.nearestSafeZone != null)
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 92,
                  child: _SafeZoneSheet(zone: bundle.nearestSafeZone!),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _MapMarker extends StatelessWidget {
  const _MapMarker({
    required this.color,
    required this.icon,
    required this.label,
  });

  final Color color;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.26),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.90),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _SafeZoneSheet extends StatelessWidget {
  const _SafeZoneSheet({required this.zone});

  final SafeZone zone;

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
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            AppLocalizations.of(context)!.nearestSafeZone,
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            zone.name,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            AppLocalizations.of(context)!.capacity(zone.currentOccupancy, zone.capacity),
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: AppColors.outline),
          ),
          if (zone.amenities.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: zone.amenities
                  .map(
                    (item) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        item,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: active
            ? AppColors.primary
            : Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            child: Text(
              label,
              style: TextStyle(
                color: active ? Colors.white : AppColors.onSurface,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

extension on SafeZone {
  GeoJsonPoint? get locationPoint => GeoJsonCodec.decodePoint(location);
  GeoJsonPolygon? get boundaryPolygon => GeoJsonCodec.decodePolygon(boundary);
}

extension on ResourceItem {
  GeoJsonPoint? get locationPoint => GeoJsonCodec.decodePoint(location);
}

extension on Disaster {
  GeoJsonPoint? get center => GeoJsonCodec.decodePoint(centerPoint);
  GeoJsonPolygon? get affectedAreaPolygon =>
      GeoJsonCodec.decodePolygon(affectedArea);

  LatLng? get mapCenter {
    if (center != null) return center!.latLng;
    final polygon = affectedAreaPolygon;
    if (polygon == null || polygon.points.isEmpty) return null;
    final lat =
        polygon.points.map((point) => point.latitude).reduce((a, b) => a + b) /
        polygon.points.length;
    final lng =
        polygon.points.map((point) => point.longitude).reduce((a, b) => a + b) /
        polygon.points.length;
    return LatLng(lat, lng);
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
