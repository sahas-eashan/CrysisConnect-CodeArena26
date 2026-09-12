import 'dart:convert';

import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.repository});

  final CitizenRepository repository;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _RouteInfo {
  const _RouteInfo({
    required this.points,
    required this.distanceKm,
    required this.durationMin,
    required this.destination,
  });

  final List<LatLng> points;
  final double distanceKm;
  final double durationMin;
  final SafeZone destination;
}

class _MapScreenState extends State<MapScreen> {
  late Future<MapBundle> _future;
  final MapController _mapController = MapController();
  String _filter = 'all';
  _RouteInfo? _activeRoute;
  bool _routeLoading = false;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadMapData();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.repository.loadMapData();
      _activeRoute = null;
    });
    await _future;
  }

  Future<void> _startNavigation(LatLng from, SafeZone zone) async {
    final l10n = AppLocalizations.of(context)!;
    final destination = zone.locationPoint;
    if (destination == null) return;

    setState(() => _routeLoading = true);

    try {
      final route = await _fetchRoute(from, destination.latLng);
      if (!mounted) return;
      if (route == null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.routeNotFound)));
        setState(() => _routeLoading = false);
        return;
      }

      setState(() {
        _activeRoute = _RouteInfo(
          points: route.points,
          distanceKm: route.distanceKm,
          durationMin: route.durationMin,
          destination: zone,
        );
        _routeLoading = false;
      });

      // Fit the map to the route bounds
      final bounds = LatLngBounds.fromPoints(route.points);
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.fromLTRB(60, 120, 60, 280),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _routeLoading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _openGoogleMapsDirections(SafeZone zone) async {
    final l10n = AppLocalizations.of(context)!;
    final destination = zone.locationPoint;
    if (destination == null) return;

    final googleMapsUri = Uri.parse(
      'google.navigation:q=${destination.latitude},${destination.longitude}&mode=d',
    );
    final browserFallbackUri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving',
    );

    try {
      final openedInMaps = await launchUrl(
        googleMapsUri,
        mode: LaunchMode.externalApplication,
      );
      if (openedInMaps || !mounted) return;

      final openedFallback = await launchUrl(
        browserFallbackUri,
        mode: LaunchMode.externalApplication,
      );
      if (openedFallback || !mounted) return;
    } catch (_) {
      if (!mounted) return;
    }

    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.googleMapsOpenFailed)));
  }

  Future<_RouteResult?> _fetchRoute(LatLng from, LatLng to) async {
    final url = Uri.parse(
      'https://router.project-osrm.org/route/v1/driving/'
      '${from.longitude},${from.latitude};'
      '${to.longitude},${to.latitude}'
      '?overview=full&geometries=geojson',
    );

    final response = await http.get(url);
    if (response.statusCode != 200) return null;

    final data = jsonDecode(response.body);
    final routes = data['routes'] as List<dynamic>?;
    if (routes == null || routes.isEmpty) return null;

    final route = routes[0];
    final geometry = route['geometry'];
    final coordinates = geometry['coordinates'] as List<dynamic>;
    final distanceMeters = (route['distance'] as num).toDouble();
    final durationSeconds = (route['duration'] as num).toDouble();

    final points = coordinates
        .map(
          (coord) => LatLng(
            (coord[1] as num).toDouble(),
            (coord[0] as num).toDouble(),
          ),
        )
        .toList();

    return _RouteResult(
      points: points,
      distanceKm: distanceMeters / 1000,
      durationMin: durationSeconds / 60,
    );
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
                child: Text(
                  '${AppLocalizations.of(context)!.retryMapLoad}\n${snapshot.error}',
                ),
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

        return Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: center,
                initialZoom: 12,
                initialRotation: 0,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.crisisconnect.citizen',
                ),
                if ((_filter == 'all' || _filter == 'disasters') &&
                    disasterPolygons.isNotEmpty)
                  PolygonLayer(polygons: disasterPolygons),
                if ((_filter == 'all' || _filter == 'safeZones') &&
                    safeZonePolygons.isNotEmpty)
                  PolygonLayer(polygons: safeZonePolygons),
                if (_activeRoute != null)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: _activeRoute!.points,
                        strokeWidth: 5,
                        color: AppColors.primary,
                      ),
                    ],
                  ),
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
                            label: AppLocalizations.of(
                              context,
                            )!.filterSafeZones,
                            active: _filter == 'safeZones',
                            onTap: () => setState(() => _filter = 'safeZones'),
                          ),
                          _FilterChip(
                            label: AppLocalizations.of(
                              context,
                            )!.filterDisasters,
                            active: _filter == 'disasters',
                            onTap: () => setState(() => _filter = 'disasters'),
                          ),
                          _FilterChip(
                            label: AppLocalizations.of(
                              context,
                            )!.filterResources,
                            active: _filter == 'resources',
                            onTap: () => setState(() => _filter = 'resources'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 20,
              right: 20,
              bottom: 116,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_activeRoute != null)
                    _NavigationBar(
                      route: _activeRoute!,
                      onCancel: () => setState(() => _activeRoute = null),
                      onOpenInGoogleMaps: () =>
                          _openGoogleMapsDirections(_activeRoute!.destination),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: FilledButton.icon(
                        onPressed: _routeLoading
                            ? null
                            : () {
                                final l10n = AppLocalizations.of(context)!;
                                if (bundle.currentLocation == null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(l10n.locationNeeded),
                                    ),
                                  );
                                  return;
                                }
                                if (bundle.nearestSafeZone == null) return;
                                _startNavigation(
                                  bundle.currentLocation!,
                                  bundle.nearestSafeZone!,
                                );
                              },
                        icon: _routeLoading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.navigation_rounded),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.secondary,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(24),
                          ),
                        ),
                        label: Text(
                          AppLocalizations.of(context)!.getMeToSafety,
                        ),
                      ),
                    ),
                  if (bundle.nearestSafeZone != null &&
                      _activeRoute == null) ...[
                    const SizedBox(height: 16),
                    _SafeZoneSheet(
                      zone: bundle.nearestSafeZone!,
                      onOpenInGoogleMaps: () =>
                          _openGoogleMapsDirections(bundle.nearestSafeZone!),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _RouteResult {
  const _RouteResult({
    required this.points,
    required this.distanceKm,
    required this.durationMin,
  });

  final List<LatLng> points;
  final double distanceKm;
  final double durationMin;
}

class _NavigationBar extends StatelessWidget {
  const _NavigationBar({
    required this.route,
    required this.onCancel,
    required this.onOpenInGoogleMaps,
  });

  final _RouteInfo route;
  final VoidCallback onCancel;
  final VoidCallback onOpenInGoogleMaps;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.30),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.navigation_rounded, color: Colors.white, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  route.destination.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${l10n.routeDistance(route.distanceKm.toStringAsFixed(1))}  •  ${l10n.routeDuration(route.durationMin.toStringAsFixed(0))}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.82),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: onOpenInGoogleMaps,
            tooltip: l10n.openInGoogleMaps,
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.18),
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.map_rounded),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onCancel,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                l10n.cancelNavigation,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
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
  const _SafeZoneSheet({required this.zone, required this.onOpenInGoogleMaps});

  final SafeZone zone;
  final VoidCallback onOpenInGoogleMaps;

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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  AppLocalizations.of(context)!.nearestSafeZone,
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: onOpenInGoogleMaps,
                icon: const Icon(Icons.map_outlined, size: 18),
                label: Text(AppLocalizations.of(context)!.directionsButton),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
            ],
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
            AppLocalizations.of(
              context,
            )!.capacity(zone.currentOccupancy, zone.capacity),
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
