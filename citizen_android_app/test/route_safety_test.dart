import 'dart:convert';

import 'package:crisisconnect_citizen/core/route_safety.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';

String polygon(List<List<num>> ring) => jsonEncode({
  'type': 'Polygon',
  'coordinates': [ring],
});
final square = polygon([
  [1, 1],
  [2, 1],
  [2, 2],
  [1, 2],
  [1, 1],
]);
Map<String, dynamic> route(List<List<num>> coordinates) => {
  'geometry': {'type': 'LineString', 'coordinates': coordinates},
  'distance': 1000,
  'duration': 60,
};

void main() {
  test('rejects polygon crossings even when both endpoints lie outside', () {
    expect(
      avoidsHazards([
        const LatLng(1.5, 0),
        const LatLng(1.5, 3),
      ], hazardRings([square])),
      isFalse,
    );
  });

  test(
    'rejects boundary touches, travel along boundaries, and interior routes',
    () {
      final rings = hazardRings([square]);
      expect(
        avoidsHazards([const LatLng(0, 0), const LatLng(1, 1)], rings),
        isFalse,
      );
      expect(
        avoidsHazards([const LatLng(1, 0), const LatLng(1, 3)], rings),
        isFalse,
      );
      expect(
        avoidsHazards([const LatLng(1.2, 1.2), const LatLng(1.8, 1.8)], rings),
        isFalse,
      );
      expect(
        avoidsHazards([const LatLng(0, 0), const LatLng(0, 3)], rings),
        isTrue,
      );
    },
  );

  test('checks every component of a MultiPolygon', () {
    final multi = jsonEncode({
      'type': 'MultiPolygon',
      'coordinates': [
        [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10],
          ],
        ],
        jsonDecode(square)['coordinates'],
      ],
    });
    expect(
      avoidsHazards([
        const LatLng(1.5, 0),
        const LatLng(1.5, 3),
      ], hazardRings([multi])),
      isFalse,
    );
  });

  test('unknown and malformed hazard boundaries fail closed', () {
    for (final geometry in [
      null,
      '',
      '{}',
      '{"type":"Polygon","coordinates":[]}',
      '{"type":"Point","coordinates":[1,1]}',
    ]) {
      expect(() => hazardRings([geometry]), throwsA(isA<NoVerifiedRoute>()));
    }
  });

  test('tries alternatives after the first route crosses a hazard', () async {
    final client = MockClient((request) async {
      expect(request.url.queryParameters['alternatives'], 'true');
      return http.Response(
        jsonEncode({
          'code': 'Ok',
          'routes': [
            route([
              [0, 1.5],
              [3, 1.5],
            ]),
            route([
              [0, 1.5],
              [0, 0],
              [3, 0],
              [3, 1.5],
            ]),
          ],
        }),
        200,
      );
    });
    final selected = await fetchScreenedRoute(
      from: const LatLng(1.5, 0),
      to: const LatLng(1.5, 3),
      activeHazardGeometries: [square],
      client: client,
    );
    expect(selected.points.length, 4);
    expect(selected.distanceKm, 1);
  });

  test(
    'all blocked routes produce an explicit failure, with no straight line',
    () async {
      final client = MockClient(
        (_) async => http.Response(
          jsonEncode({
            'code': 'Ok',
            'routes': [
              route([
                [0, 1.5],
                [3, 1.5],
              ]),
            ],
          }),
          200,
        ),
      );
      await expectLater(
        fetchScreenedRoute(
          from: const LatLng(1.5, 0),
          to: const LatLng(1.5, 3),
          activeHazardGeometries: [square],
          client: client,
        ),
        throwsA(isA<NoVerifiedRoute>()),
      );
    },
  );

  test(
    'checks access to snapped road endpoints before accepting a route',
    () async {
      final client = MockClient(
        (_) async => http.Response(
          jsonEncode({
            'code': 'Ok',
            'routes': [
              route([
                [3, 1.5],
                [4, 1.5],
              ]),
            ],
          }),
          200,
        ),
      );
      await expectLater(
        fetchScreenedRoute(
          from: const LatLng(1.5, 0),
          to: const LatLng(1.5, 4),
          activeHazardGeometries: [square],
          client: client,
        ),
        throwsA(isA<NoVerifiedRoute>()),
      );
    },
  );

  test(
    'provider failures and malformed geometry never create a route',
    () async {
      for (final response in [
        http.Response('unavailable', 503),
        http.Response('not json', 200),
        http.Response(
          jsonEncode({
            'code': 'Ok',
            'routes': [
              route([
                [0, 999],
                [3, 1],
              ]),
            ],
          }),
          200,
        ),
      ]) {
        await expectLater(
          fetchScreenedRoute(
            from: const LatLng(0, 0),
            to: const LatLng(0, 3),
            activeHazardGeometries: [],
            client: MockClient((_) async => response),
          ),
          throwsA(isA<NoVerifiedRoute>()),
        );
      }
    },
  );
}
