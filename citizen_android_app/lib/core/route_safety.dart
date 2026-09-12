import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

class NoVerifiedRoute implements Exception {
  const NoVerifiedRoute(this.reason);
  final String reason;
  @override
  String toString() => 'No verified route available. $reason';
}

class ScreenedRoute {
  const ScreenedRoute({
    required this.points,
    required this.distanceKm,
    required this.durationMin,
  });
  final List<LatLng> points;
  final double distanceKm;
  final double durationMin;
}

LatLng _position(dynamic value) {
  if (value is! List ||
      value.length < 2 ||
      value[0] is! num ||
      value[1] is! num) {
    throw const NoVerifiedRoute('Invalid map coordinates.');
  }
  final lon = (value[0] as num).toDouble();
  final lat = (value[1] as num).toDouble();
  if (!lon.isFinite || !lat.isFinite || lon.abs() > 180 || lat.abs() > 90) {
    throw const NoVerifiedRoute('Invalid map coordinates.');
  }
  return LatLng(lat, lon);
}

/// Conservatively blocks polygon holes as well; every MultiPolygon part is checked.
/// Unknown/missing boundaries block routing instead of treating a hazard as absent.
List<List<LatLng>> hazardRings(Iterable<String?> geometries) {
  final rings = <List<LatLng>>[];
  try {
    for (final raw in geometries) {
      if (raw == null || raw.isEmpty) throw const FormatException();
      final geometry = jsonDecode(raw);
      if (geometry is! Map) throw const FormatException();
      final dynamic polygons = switch (geometry['type']) {
        'Polygon' => [geometry['coordinates']],
        'MultiPolygon' => geometry['coordinates'],
        _ => throw const FormatException(),
      };
      if (polygons is! List || polygons.isEmpty) throw const FormatException();
      for (final polygon in polygons) {
        if (polygon is! List || polygon.isEmpty || polygon.first is! List) {
          throw const FormatException();
        }
        final ring = (polygon.first as List).map(_position).toList();
        if (ring.length < 4 || ring.first != ring.last) {
          throw const FormatException();
        }
        for (var i = 1; i < ring.length; i++) {
          if ((ring[i].longitude - ring[i - 1].longitude).abs() > 180) {
            throw const FormatException();
          }
        }
        rings.add(ring);
      }
    }
  } catch (_) {
    throw const NoVerifiedRoute(
      'An active hazard has an unavailable or invalid boundary.',
    );
  }
  return rings;
}

double _cross(LatLng a, LatLng b, LatLng p) =>
    (b.longitude - a.longitude) * (p.latitude - a.latitude) -
    (b.latitude - a.latitude) * (p.longitude - a.longitude);

bool _onSegment(LatLng a, LatLng b, LatLng p) {
  const epsilon = 1e-10;
  return _cross(a, b, p).abs() <= epsilon &&
      p.longitude >=
          (a.longitude < b.longitude ? a.longitude : b.longitude) - epsilon &&
      p.longitude <=
          (a.longitude > b.longitude ? a.longitude : b.longitude) + epsilon &&
      p.latitude >=
          (a.latitude < b.latitude ? a.latitude : b.latitude) - epsilon &&
      p.latitude <=
          (a.latitude > b.latitude ? a.latitude : b.latitude) + epsilon;
}

bool _intersects(LatLng a, LatLng b, LatLng c, LatLng d) {
  if (_onSegment(a, b, c) ||
      _onSegment(a, b, d) ||
      _onSegment(c, d, a) ||
      _onSegment(c, d, b)) {
    return true;
  }
  return (_cross(a, b, c) > 0) != (_cross(a, b, d) > 0) &&
      (_cross(c, d, a) > 0) != (_cross(c, d, b) > 0);
}

bool _inside(LatLng point, List<LatLng> ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    final a = ring[i];
    final b = ring[j];
    if (_onSegment(a, b, point)) return true;
    if ((a.latitude > point.latitude) != (b.latitude > point.latitude) &&
        point.longitude <
            (b.longitude - a.longitude) *
                    (point.latitude - a.latitude) /
                    (b.latitude - a.latitude) +
                a.longitude) {
      inside = !inside;
    }
  }
  return inside;
}

/// Checks every segment, including crossings with both endpoints outside a hazard.
bool avoidsHazards(List<LatLng> points, List<List<LatLng>> rings) {
  if (points.length < 2) return false;
  for (var i = 1; i < points.length; i++) {
    if ((points[i].longitude - points[i - 1].longitude).abs() > 180) {
      return false;
    }
  }
  for (final ring in rings) {
    if (points.any((point) => _inside(point, ring))) return false;
    for (var i = 1; i < points.length; i++) {
      for (var j = 1; j < ring.length; j++) {
        if (_intersects(points[i - 1], points[i], ring[j - 1], ring[j])) {
          return false;
        }
      }
    }
  }
  return true;
}

Future<ScreenedRoute> fetchScreenedRoute({
  required LatLng from,
  required LatLng to,
  required Iterable<String?> activeHazardGeometries,
  http.Client? client,
}) async {
  final rings = hazardRings(activeHazardGeometries);
  final transport = client ?? http.Client();
  try {
    final response = await transport
        .get(
          Uri.parse(
            'https://router.project-osrm.org/route/v1/driving/'
            '${from.longitude},${from.latitude};${to.longitude},${to.latitude}'
            '?overview=full&geometries=geojson&alternatives=true',
          ),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw const NoVerifiedRoute('The routing service is unavailable.');
    }
    final data = jsonDecode(response.body);
    if (data is! Map || data['code'] != 'Ok' || data['routes'] is! List) {
      throw const NoVerifiedRoute(
        'The routing service returned no usable routes.',
      );
    }
    for (final route in data['routes'] as List) {
      try {
        if (route['geometry']['type'] != 'LineString') continue;
        final points = (route['geometry']['coordinates'] as List)
            .map(_position)
            .toList();
        final distance = (route['distance'] as num).toDouble();
        final duration = (route['duration'] as num).toDouble();
        if (!distance.isFinite ||
            !duration.isFinite ||
            distance < 0 ||
            duration < 0 ||
            points.length < 2) {
          continue;
        }
        // Also screen access between the actual endpoints and the provider's snapped road endpoints.
        if (!avoidsHazards([from, ...points, to], rings)) continue;
        return ScreenedRoute(
          points: points,
          distanceKm: distance / 1000,
          durationMin: duration / 60,
        );
      } catch (_) {
        // A malformed alternative is discarded; subsequent alternatives still get checked.
      }
    }
    throw const NoVerifiedRoute(
      'All returned alternatives cross a known hazard or contain invalid geometry. Follow official evacuation instructions.',
    );
  } on NoVerifiedRoute {
    rethrow;
  } catch (_) {
    throw const NoVerifiedRoute(
      'The route could not be checked. Try again when the service is available.',
    );
  } finally {
    if (client == null) transport.close();
  }
}
