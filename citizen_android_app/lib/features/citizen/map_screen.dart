import 'dart:ui';
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

class _MapDestination {
  const _MapDestination({
    required this.title,
    required this.kindLabel,
    required this.destination,
    required this.icon,
    required this.color,
    this.subtitle,
    this.secondaryText,
    this.chips = const [],
  });

  final String title;
  final String kindLabel;
  final String? subtitle;
  final String? secondaryText;
  final List<String> chips;
  final LatLng destination;
  final IconData icon;
  final Color color;
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
  final _MapDestination destination;
}

class _MapFilterOption {
  const _MapFilterOption({
    required this.value,
    required this.label,
    required this.icon,
    required this.count,
    required this.color,
  });

  final String value;
  final String label;
  final IconData icon;
  final int count;
  final Color color;
}

class _MapScreenState extends State<MapScreen> {
  static const double _markerWidth = 104;
  static const double _markerHeight = 82;
  static const double _focusZoom = 13.6;

  late Future<MapBundle> _future;
  final MapController _mapController = MapController();
  String _filter = 'all';
  _RouteInfo? _activeRoute;
  _MapDestination? _selectedDestination;
  bool _routeLoading = false;
  bool _locatingUser = false;
  LatLng? _liveCurrentLocation;
  SafeZone? _liveNearestSafeZone;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadMapData();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.repository.loadMapData();
      _activeRoute = null;
      _selectedDestination = null;
    });
    await _future;
  }

  void _setFilter(String value) {
    setState(() {
      _filter = value;
      _selectedDestination = null;
    });
  }

  void _selectDestination(_MapDestination destination) {
    setState(() {
      _selectedDestination = destination;
      _activeRoute = null;
    });
  }

  Future<void> _cacheNearestSafeZone(LatLng location) async {
    final nearest = await widget.repository.loadNearestSafeZoneForLocation(
      location,
    );
    if (!mounted) return;
    setState(() => _liveNearestSafeZone = nearest);
  }

  Future<LatLng?> _resolveCurrentLocation({
    required LatLng? currentLocation,
    bool recenter = false,
    bool showError = true,
  }) async {
    final existingLocation = currentLocation ?? _liveCurrentLocation;
    if (existingLocation != null) {
      if (recenter) {
        _mapController.move(existingLocation, _focusZoom);
      }
      return existingLocation;
    }

    final l10n = AppLocalizations.of(context)!;
    setState(() => _locatingUser = true);

    try {
      final location = await widget.repository.resolveCurrentLocation(
        forcePrompt: true,
      );
      if (!mounted) return null;

      if (location == null) {
        if (showError) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(l10n.locationNeeded)));
        }
        return null;
      }

      setState(() => _liveCurrentLocation = location);
      if (recenter) {
        _mapController.move(location, _focusZoom);
      }
      _cacheNearestSafeZone(location);
      return location;
    } finally {
      if (mounted) {
        setState(() => _locatingUser = false);
      }
    }
  }

  Future<void> _startNavigationFor(
    _MapDestination destination, {
    required LatLng? currentLocation,
  }) async {
    final origin = await _resolveCurrentLocation(
      currentLocation: currentLocation,
      recenter: true,
    );
    if (!mounted || origin == null) return;
    await _startNavigation(origin, destination);
  }

  Future<void> _startNavigation(
    LatLng from,
    _MapDestination destination,
  ) async {
    final l10n = AppLocalizations.of(context)!;

    setState(() => _routeLoading = true);

    try {
      final route = await _fetchRoute(from, destination.destination);
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
          destination: destination,
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

  Future<void> _openGoogleMapsDirections(_MapDestination destination) async {
    final l10n = AppLocalizations.of(context)!;

    final googleMapsUri = Uri.parse(
      'google.navigation:q=${destination.destination.latitude},${destination.destination.longitude}&mode=d',
    );
    final browserFallbackUri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${destination.destination.latitude},${destination.destination.longitude}&travelmode=driving',
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

  _MapDestination _buildSafeZoneDestination(
    SafeZone zone,
    AppLocalizations l10n,
  ) {
    return _MapDestination(
      title: zone.name,
      kindLabel: l10n.safeZones,
      subtitle: l10n.capacity(zone.currentOccupancy, zone.capacity),
      secondaryText: zone.status?.toUpperCase(),
      chips: zone.amenities,
      destination: zone.locationPoint!.latLng,
      icon: Icons.home_rounded,
      color: AppColors.tertiary,
    );
  }

  _MapDestination _buildResourceDestination(
    ResourceItem resource,
    AppLocalizations l10n,
  ) {
    final subtitleParts = <String>[
      if (resource.category != null && resource.category!.trim().isNotEmpty)
        resource.category!,
      if (resource.quantity != null)
        '${resource.quantity} ${resource.unit ?? l10n.units}',
    ];

    final chips = <String>[
      if (resource.status != null && resource.status!.trim().isNotEmpty)
        resource.status!.toUpperCase(),
    ];

    return _MapDestination(
      title: resource.name,
      kindLabel: l10n.resources,
      subtitle: subtitleParts.isEmpty ? null : subtitleParts.join(' • '),
      secondaryText: resource.managedBy == null
          ? null
          : l10n.managedBy(resource.managedBy!),
      chips: chips,
      destination: resource.locationPoint!.latLng,
      icon: Icons.inventory_2_rounded,
      color: AppColors.primary,
    );
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
        final l10n = AppLocalizations.of(context)!;
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: FilledButton(
                onPressed: _refresh,
                child: Text('${l10n.retryMapLoad}\n${snapshot.error}'),
              ),
            ),
          );
        }

        final bundle = snapshot.data!;
        final currentLocation = _liveCurrentLocation ?? bundle.currentLocation;
        final nearestSafeZone = _liveNearestSafeZone ?? bundle.nearestSafeZone;
        final nearestDestination = nearestSafeZone?.locationPoint == null
            ? null
            : _buildSafeZoneDestination(nearestSafeZone!, l10n);
        final displayedDestination = _selectedDestination ?? nearestDestination;
        final center =
            currentLocation ??
            nearestSafeZone?.locationPoint?.latLng ??
            bundle.safeZones.firstOrNull?.locationPoint?.latLng ??
            bundle.disasters.firstOrNull?.mapCenter ??
            const LatLng(6.9271, 79.8612);
        final filterOptions = <_MapFilterOption>[
          _MapFilterOption(
            value: 'all',
            label: l10n.filterAll,
            icon: Icons.dashboard_customize_rounded,
            count:
                bundle.safeZones.length +
                bundle.disasters.length +
                bundle.resources.length,
            color: AppColors.primary,
          ),
          _MapFilterOption(
            value: 'safeZones',
            label: l10n.filterSafeZones,
            icon: Icons.shield_rounded,
            count: bundle.safeZones.length,
            color: AppColors.tertiary,
          ),
          _MapFilterOption(
            value: 'disasters',
            label: l10n.filterDisasters,
            icon: Icons.warning_amber_rounded,
            count: bundle.disasters.length,
            color: AppColors.secondary,
          ),
          _MapFilterOption(
            value: 'resources',
            label: l10n.filterResources,
            icon: Icons.inventory_2_rounded,
            count: bundle.resources.length,
            color: AppColors.primary,
          ),
        ];

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
                    width: _MapScreenState._markerWidth,
                    height: _MapScreenState._markerHeight,
                    child: _MapMarker(
                      color: AppColors.tertiary,
                      icon: Icons.home_rounded,
                      label: zone.name,
                      onTap: () => _selectDestination(
                        _buildSafeZoneDestination(zone, l10n),
                      ),
                    ),
                  ),
                ),
          if (_filter == 'all' || _filter == 'resources')
            ...bundle.resources
                .where((resource) => resource.locationPoint != null)
                .map(
                  (resource) => Marker(
                    point: resource.locationPoint!.latLng,
                    width: _MapScreenState._markerWidth,
                    height: _MapScreenState._markerHeight,
                    child: _MapMarker(
                      color: AppColors.primary,
                      icon: Icons.inventory_2_rounded,
                      label: resource.name,
                      onTap: () => _selectDestination(
                        _buildResourceDestination(resource, l10n),
                      ),
                    ),
                  ),
                ),
          if (currentLocation != null)
            Marker(
              point: currentLocation,
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
                onTap: (_, point) {
                  if (_selectedDestination == null || _activeRoute != null) {
                    return;
                  }
                  setState(() => _selectedDestination = null);
                },
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
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 0),
                child: _MapFilterPanel(
                  locationLabel: currentLocation == null
                      ? l10n.locationNeeded
                      : l10n.locationReady,
                  hasCurrentLocation: currentLocation != null,
                  locatingUser: _locatingUser,
                  onLocate: () => _resolveCurrentLocation(
                    currentLocation: currentLocation,
                    recenter: true,
                  ),
                  filters: filterOptions,
                  activeFilter: _filter,
                  onSelectFilter: _setFilter,
                ),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              bottom: 96,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_activeRoute != null)
                    _NavigationBar(
                      route: _activeRoute!,
                      onCancel: () => setState(() {
                        _selectedDestination = _activeRoute!.destination;
                        _activeRoute = null;
                      }),
                      onOpenInGoogleMaps: () =>
                          _openGoogleMapsDirections(_activeRoute!.destination),
                    )
                  else if (nearestDestination != null &&
                      _selectedDestination == null)
                    Align(
                      alignment: Alignment.centerRight,
                      child: _SafetyFab(
                        loading: _routeLoading,
                        tooltip: l10n.getMeToSafety,
                        onPressed: () => _startNavigationFor(
                          nearestDestination,
                          currentLocation: currentLocation,
                        ),
                      ),
                    ),
                  if (displayedDestination != null && _activeRoute == null) ...[
                    const SizedBox(height: 12),
                    _DestinationSheet(
                      heading: _selectedDestination == null
                          ? l10n.nearestSafeZone
                          : displayedDestination.kindLabel,
                      destination: displayedDestination,
                      primaryLabel: l10n.inAppDirections,
                      secondaryLabel: l10n.openInGoogleMaps,
                      onClose: _selectedDestination == null
                          ? null
                          : () => setState(() => _selectedDestination = null),
                      onStartNavigation: () => _startNavigationFor(
                        displayedDestination,
                        currentLocation: currentLocation,
                      ),
                      onOpenInGoogleMaps: () =>
                          _openGoogleMapsDirections(displayedDestination),
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
                  route.destination.title,
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

class _MapFilterPanel extends StatelessWidget {
  const _MapFilterPanel({
    required this.locationLabel,
    required this.hasCurrentLocation,
    required this.locatingUser,
    required this.onLocate,
    required this.filters,
    required this.activeFilter,
    required this.onSelectFilter,
  });

  final String locationLabel;
  final bool hasCurrentLocation;
  final bool locatingUser;
  final VoidCallback onLocate;
  final List<_MapFilterOption> filters;
  final String activeFilter;
  final ValueChanged<String> onSelectFilter;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.76),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.58)),
            boxShadow: [
              BoxShadow(
                color: AppColors.inverseSurface.withValues(alpha: 0.10),
                blurRadius: 28,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _LocationStatusPill(
                      label: locationLabel,
                      active: hasCurrentLocation,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _LocateButton(
                    locatingUser: locatingUser,
                    hasCurrentLocation: hasCurrentLocation,
                    onTap: onLocate,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: filters
                      .map(
                        (filter) => _FilterChip(
                          label: filter.label,
                          icon: filter.icon,
                          count: filter.count,
                          tintColor: filter.color,
                          active: activeFilter == filter.value,
                          onTap: () => onSelectFilter(filter.value),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationStatusPill extends StatelessWidget {
  const _LocationStatusPill({required this.label, required this.active});

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final accent = active ? AppColors.tertiary : AppColors.secondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Icon(
            active
                ? Icons.my_location_rounded
                : Icons.location_searching_rounded,
            color: accent,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.onSurface,
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocateButton extends StatelessWidget {
  const _LocateButton({
    required this.locatingUser,
    required this.hasCurrentLocation,
    required this.onTap,
  });

  final bool locatingUser;
  final bool hasCurrentLocation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final background = hasCurrentLocation
        ? AppColors.primary
        : AppColors.surfaceLowest;
    final foreground = hasCurrentLocation ? Colors.white : AppColors.primary;

    return Material(
      color: background,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: locatingUser ? null : onTap,
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          width: 42,
          height: 42,
          child: Center(
            child: locatingUser
                ? SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: foreground,
                    ),
                  )
                : Icon(Icons.near_me_rounded, color: foreground, size: 20),
          ),
        ),
      ),
    );
  }
}

class _MapMarker extends StatelessWidget {
  const _MapMarker({
    required this.color,
    required this.icon,
    required this.label,
    this.onTap,
  });

  final Color color;
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
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
      ),
    );
  }
}

class _SafetyFab extends StatelessWidget {
  const _SafetyFab({
    required this.loading,
    required this.onPressed,
    required this.tooltip,
  });

  final bool loading;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Tooltip(
        message: tooltip,
        child: FilledButton(
          onPressed: loading ? null : onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.secondary,
            shape: const CircleBorder(),
            padding: const EdgeInsets.all(18),
            minimumSize: const Size(64, 64),
          ),
          child: loading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.navigation_rounded, size: 28),
        ),
      ),
    );
  }
}

class _DestinationSheet extends StatelessWidget {
  const _DestinationSheet({
    required this.heading,
    required this.destination,
    required this.primaryLabel,
    required this.secondaryLabel,
    required this.onStartNavigation,
    required this.onOpenInGoogleMaps,
    this.onClose,
  });

  final String heading;
  final _MapDestination destination;
  final String primaryLabel;
  final String secondaryLabel;
  final VoidCallback onStartNavigation;
  final VoidCallback onOpenInGoogleMaps;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final subtitleStyle = Theme.of(
      context,
    ).textTheme.bodyMedium?.copyWith(color: AppColors.outline);
    final compactAction =
        destination.chips.length > 2 ||
        (destination.subtitle?.length ?? 0) > 24 ||
        (destination.title.length > 20);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.94)),
        boxShadow: [
          BoxShadow(
            color: AppColors.inverseSurface.withValues(alpha: 0.12),
            blurRadius: 32,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Align(
            alignment: Alignment.center,
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.surfaceHighest,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: destination.color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(destination.icon, color: destination.color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: destination.color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        heading,
                        style: TextStyle(
                          color: destination.color,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      destination.title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
              if (onClose != null) ...[
                const SizedBox(width: 8),
                IconButton(
                  onPressed: onClose,
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surfaceLow,
                    foregroundColor: AppColors.primary,
                    minimumSize: const Size(36, 36),
                    padding: EdgeInsets.zero,
                  ),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ],
          ),
          if (destination.subtitle != null) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.route_rounded, size: 16, color: destination.color),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(destination.subtitle!, style: subtitleStyle),
                ),
              ],
            ),
          ],
          if (destination.secondaryText != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    size: 15,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      destination.secondaryText!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.surfaceVariantText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: compactAction
                    ? Text(
                        'Directions',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppColors.surfaceVariantText,
                          fontWeight: FontWeight.w700,
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
              const SizedBox(width: 10),
              _SheetActionButton(
                onPressed: onStartNavigation,
                tooltip: primaryLabel,
                icon: Icons.navigation_rounded,
                backgroundColor: destination.color,
                foregroundColor: Colors.white,
              ),
              const SizedBox(width: 8),
              _SheetActionButton(
                onPressed: onOpenInGoogleMaps,
                tooltip: secondaryLabel,
                icon: Icons.map_outlined,
                backgroundColor: AppColors.surfaceLowest,
                foregroundColor: AppColors.primary,
                borderColor: AppColors.primary.withValues(alpha: 0.22),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SheetActionButton extends StatelessWidget {
  const _SheetActionButton({
    required this.onPressed,
    required this.tooltip,
    required this.icon,
    required this.backgroundColor,
    required this.foregroundColor,
    this.borderColor,
  });

  final VoidCallback onPressed;
  final String tooltip;
  final IconData icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          elevation: 0,
          minimumSize: const Size(46, 46),
          padding: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(23),
            side: borderColor == null
                ? BorderSide.none
                : BorderSide(color: borderColor!),
          ),
        ),
        child: Icon(icon, size: 22),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.icon,
    required this.count,
    required this.tintColor,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final int count;
  final Color tintColor;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final backgroundColor = active
        ? tintColor
        : Colors.white.withValues(alpha: 0.80);
    final foregroundColor = active ? Colors.white : AppColors.onSurface;

    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        elevation: active ? 1.5 : 0,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: foregroundColor),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    color: foregroundColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: active
                        ? Colors.white.withValues(alpha: 0.18)
                        : tintColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$count',
                    style: TextStyle(
                      color: active ? Colors.white : tintColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
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
