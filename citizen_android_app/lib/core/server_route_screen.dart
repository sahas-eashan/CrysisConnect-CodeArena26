import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import 'route_safety.dart';

/// Checks candidate geometry against the authenticated server's current hazard state.
/// No private case data is downloaded to the mobile routing client.
class ServerRouteScreen {
  const ServerRouteScreen({
    required this.baseOrigin,
    required this.idToken,
    this.client,
  });

  final String baseOrigin;
  final Future<String> Function() idToken;
  final http.Client? client;

  Uri _endpoint() {
    final uri = Uri.tryParse(baseOrigin);
    final localDebug =
        !const bool.fromEnvironment('dart.vm.product') &&
        uri != null &&
        [
          'localhost',
          '127.0.0.1',
          '::1',
          '[::1]',
          '10.0.2.2',
        ].contains(uri.host);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/') ||
        (uri.scheme != 'https' && !(localDebug && uri.scheme == 'http'))) {
      throw const NoVerifiedRoute(
        'The hazard verification service URL is missing or invalid. Configure CRISIS_HAZARD_API_URL.',
      );
    }
    return uri.resolve('/api/hazards');
  }

  Future<bool> call(List<LatLng> coordinates) async {
    final endpoint = _endpoint();
    final transport = client ?? http.Client();
    try {
      final token = await idToken();
      if (token.trim().isEmpty) {
        throw const NoVerifiedRoute('Sign in again to verify current hazards.');
      }
      final request = http.Request('POST', endpoint)
        ..followRedirects = false
        ..headers.addAll({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        })
        ..body = jsonEncode({
          'action': 'screenRoute',
          'input': {
            'coordinates': coordinates
                .map((point) => [point.longitude, point.latitude])
                .toList(),
          },
        });
      final streamed = await transport
          .send(request)
          .timeout(const Duration(seconds: 20));
      final response = await http.Response.fromStream(
        streamed,
      ).timeout(const Duration(seconds: 20));
      if (response.statusCode != 200) {
        throw const NoVerifiedRoute(
          'The current hazard check failed. Check your connection and sign-in, then retry.',
        );
      }
      if (response.body.length > 20000) throw const FormatException();
      final result = jsonDecode(response.body);
      if (result is! Map ||
          result['safe'] is! bool ||
          result['reason'] is! String ||
          (result['reason'] as String).trim().isEmpty ||
          result['checkedAt'] is! String) {
        throw const FormatException();
      }
      final checkedAt = DateTime.tryParse(result['checkedAt'] as String);
      if (checkedAt == null ||
          DateTime.now().difference(checkedAt).abs() >
              const Duration(minutes: 2)) {
        throw const FormatException();
      }
      return result['safe'] == true;
    } on NoVerifiedRoute {
      rethrow;
    } catch (_) {
      throw const NoVerifiedRoute(
        'Current hazards could not be verified by the server. No route has been approved.',
      );
    } finally {
      if (client == null) transport.close();
    }
  }
}
