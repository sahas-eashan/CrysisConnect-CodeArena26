import 'dart:convert';

import 'package:crisisconnect_citizen/core/route_safety.dart';
import 'package:crisisconnect_citizen/core/server_route_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:latlong2/latlong.dart';

final sample = [const LatLng(6.9, 79.8), const LatLng(6.91, 79.82)];
Map<String, dynamic> verdict(bool safe) => {
  'safe': safe,
  'reason': 'Current server hazard screen completed.',
  'checkedAt': DateTime.now().toUtc().toIso8601String(),
};

void main() {
  test(
    'posts longitude/latitude geometry with an ID token and rejects redirects',
    () async {
      final screen = ServerRouteScreen(
        baseOrigin: 'https://hazards.example',
        idToken: () async => 'test-id-token',
        client: MockClient((request) async {
          expect(request.method, 'POST');
          expect(request.url.toString(), 'https://hazards.example/api/hazards');
          expect(request.headers['Authorization'], 'Bearer test-id-token');
          expect(request.followRedirects, isFalse);
          expect(jsonDecode(request.body), {
            'action': 'screenRoute',
            'input': {
              'coordinates': [
                [79.8, 6.9],
                [79.82, 6.91],
              ],
            },
          });
          return http.Response(jsonEncode(verdict(true)), 200);
        }),
      );
      expect(await screen.call(sample), isTrue);
    },
  );

  test(
    'missing or insecure public URL stops before credentials or network calls',
    () async {
      for (final origin in [
        '',
        'not a URL',
        'http://public.example',
        'https://user:password@hazards.example',
        'https://hazards.example/api/hazards',
      ]) {
        final screen = ServerRouteScreen(
          baseOrigin: origin,
          idToken: () async {
            fail('Credentials must not be read for invalid configuration');
          },
          client: MockClient((_) async {
            fail('Invalid configuration must not contact any server');
          }),
        );
        await expectLater(screen.call(sample), throwsA(isA<NoVerifiedRoute>()));
      }
    },
  );

  test('missing token never sends a request', () async {
    final screen = ServerRouteScreen(
      baseOrigin: 'https://hazards.example',
      idToken: () async => '',
      client: MockClient((_) async {
        fail('An unauthenticated request must not be sent');
      }),
    );
    await expectLater(screen.call(sample), throwsA(isA<NoVerifiedRoute>()));
  });

  test(
    'false is a rejected candidate, while malformed or stale success is unavailable',
    () async {
      final rejected = ServerRouteScreen(
        baseOrigin: 'https://hazards.example',
        idToken: () async => 'test-token',
        client: MockClient(
          (_) async => http.Response(jsonEncode(verdict(false)), 200),
        ),
      );
      expect(await rejected.call(sample), isFalse);
      for (final response in [
        http.Response('unauthorized', 401),
        http.Response('unavailable', 503),
        http.Response(
          '',
          302,
          headers: {'location': 'https://another.example'},
        ),
        http.Response('not json', 200),
        http.Response(jsonEncode({'safe': true}), 200),
        http.Response(jsonEncode({...verdict(true), 'safe': 'true'}), 200),
        http.Response(
          jsonEncode({...verdict(true), 'checkedAt': '2020-01-01T00:00:00Z'}),
          200,
        ),
      ]) {
        final screen = ServerRouteScreen(
          baseOrigin: 'https://hazards.example',
          idToken: () async => 'test-token',
          client: MockClient((_) async => response),
        );
        await expectLater(screen.call(sample), throwsA(isA<NoVerifiedRoute>()));
      }
    },
  );

  test('network failure cannot become a safe result', () async {
    final screen = ServerRouteScreen(
      baseOrigin: 'https://hazards.example',
      idToken: () async => 'test-token',
      client: MockClient((_) async {
        throw http.ClientException('offline');
      }),
    );
    await expectLater(screen.call(sample), throwsA(isA<NoVerifiedRoute>()));
  });

  test(
    'each locally acceptable alternative is checked including snapped approaches',
    () async {
      var screenRequests = 0;
      final client = MockClient((request) async {
        if (request.method == 'GET') {
          return http.Response(
            jsonEncode({
              'code': 'Ok',
              'routes': [
                {
                  'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                      [0, 0],
                      [3, 0],
                    ],
                  },
                  'distance': 1000,
                  'duration': 60,
                },
                {
                  'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                      [0, 0],
                      [0, 1],
                      [3, 1],
                      [3, 0],
                    ],
                  },
                  'distance': 2000,
                  'duration': 120,
                },
              ],
            }),
            200,
          );
        }
        screenRequests++;
        final coordinates =
            jsonDecode(request.body)['input']['coordinates'] as List;
        expect(coordinates.first, [-0.001, 0]);
        expect(coordinates.last, [3.001, 0]);
        return http.Response(jsonEncode(verdict(screenRequests == 2)), 200);
      });
      final screen = ServerRouteScreen(
        baseOrigin: 'https://hazards.example',
        idToken: () async => 'test-token',
        client: client,
      );
      final result = await fetchScreenedRoute(
        from: const LatLng(0, -0.001),
        to: const LatLng(0, 3.001),
        activeHazardGeometries: [],
        screenOnServer: screen.call,
        client: client,
      );
      expect(screenRequests, 2);
      expect(result.points.length, 4);
      expect(result.distanceKm, 2);
    },
  );

  test(
    'a server outage prevents displaying an otherwise clear road route',
    () async {
      final client = MockClient(
        (request) async => request.method == 'POST'
            ? http.Response('unavailable', 503)
            : http.Response(
                jsonEncode({
                  'code': 'Ok',
                  'routes': [
                    {
                      'geometry': {
                        'type': 'LineString',
                        'coordinates': [
                          [0, 0],
                          [3, 0],
                        ],
                      },
                      'distance': 1000,
                      'duration': 60,
                    },
                  ],
                }),
                200,
              ),
      );
      final screen = ServerRouteScreen(
        baseOrigin: 'https://hazards.example',
        idToken: () async => 'test-token',
        client: client,
      );
      await expectLater(
        fetchScreenedRoute(
          from: const LatLng(0, 0),
          to: const LatLng(0, 3),
          activeHazardGeometries: [],
          screenOnServer: screen.call,
          client: client,
        ),
        throwsA(isA<NoVerifiedRoute>()),
      );
    },
  );
}
