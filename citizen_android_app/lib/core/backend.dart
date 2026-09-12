import 'dart:async';
import 'dart:convert';

import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class AppConfig {
  const AppConfig.empty()
    : awsRegion = '',
      userPoolId = '',
      userPoolClientId = '',
      graphqlUrl = '',
      apiName = 'data';

  const AppConfig._({
    required this.awsRegion,
    required this.userPoolId,
    required this.userPoolClientId,
    required this.graphqlUrl,
    required this.apiName,
  });

  factory AppConfig.fromEnvironment() {
    return const AppConfig._(
      awsRegion: String.fromEnvironment('CRISIS_AWS_REGION'),
      userPoolId: String.fromEnvironment('CRISIS_COGNITO_USER_POOL_ID'),
      userPoolClientId: String.fromEnvironment(
        'CRISIS_COGNITO_USER_POOL_CLIENT_ID',
      ),
      graphqlUrl: String.fromEnvironment('CRISIS_APPSYNC_GRAPHQL_URL'),
      apiName: String.fromEnvironment(
        'CRISIS_APPSYNC_API_NAME',
        defaultValue: 'data',
      ),
    );
  }

  factory AppConfig.fromJson(Map<String, dynamic> json) {
    String readString(String key, [String fallback = '']) {
      final value = json[key];
      return value is String ? value : fallback;
    }

    return AppConfig._(
      awsRegion: readString('CRISIS_AWS_REGION'),
      userPoolId: readString('CRISIS_COGNITO_USER_POOL_ID'),
      userPoolClientId: readString('CRISIS_COGNITO_USER_POOL_CLIENT_ID'),
      graphqlUrl: readString('CRISIS_APPSYNC_GRAPHQL_URL'),
      apiName: readString('CRISIS_APPSYNC_API_NAME', 'data'),
    );
  }

  static Future<AppConfig> load() async {
    final envConfig = AppConfig.fromEnvironment();
    if (envConfig.isConfigured) return envConfig;

    try {
      final raw = await rootBundle.loadString(
        'assets/config/runtime_config.json',
      );
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        final assetConfig = AppConfig.fromJson(decoded);
        if (assetConfig.isConfigured) {
          return assetConfig;
        }
      }
    } catch (_) {
      // Fall back to the empty config so the app can still show the guidance UI.
    }

    return envConfig;
  }

  final String awsRegion;
  final String userPoolId;
  final String userPoolClientId;
  final String graphqlUrl;
  final String apiName;

  bool get isConfigured =>
      awsRegion.isNotEmpty &&
      userPoolId.isNotEmpty &&
      userPoolClientId.isNotEmpty &&
      graphqlUrl.isNotEmpty;

  String get amplifyOutputsJson {
    return jsonEncode({
      'version': '1',
      'auth': {
        'aws_region': awsRegion,
        'user_pool_id': userPoolId,
        'user_pool_client_id': userPoolClientId,
        'username_attributes': ['email', 'phone_number'],
        'standard_required_attributes': ['email'],
        'user_verification_types': ['email'],
        'unauthenticated_identities_enabled': false,
      },
      'data': {
        'aws_region': awsRegion,
        'url': graphqlUrl,
        'default_authorization_type': 'AMAZON_COGNITO_USER_POOLS',
        'authorization_types': ['AMAZON_COGNITO_USER_POOLS'],
      },
    });
  }
}

class AppSession {
  const AppSession({
    required this.isConfigured,
    required this.isSignedIn,
    this.userId,
    this.username,
    this.groups = const [],
  });

  final bool isConfigured;
  final bool isSignedIn;
  final String? userId;
  final String? username;
  final List<String> groups;
}

class NewPasswordRequiredException implements Exception {
  const NewPasswordRequiredException();

  @override
  String toString() {
    return 'A new password is required to complete the first sign-in for this account.';
  }
}

class DashboardBundle {
  const DashboardBundle({
    required this.stats,
    required this.disasters,
    required this.safeZones,
    required this.news,
    this.nearestSafeZone,
  });

  final DashboardStats stats;
  final List<Disaster> disasters;
  final List<SafeZone> safeZones;
  final List<NewsUpdate> news;
  final SafeZone? nearestSafeZone;
}

class MapBundle {
  const MapBundle({
    required this.disasters,
    required this.safeZones,
    required this.resources,
    this.nearestSafeZone,
    this.currentLocation,
  });

  final List<Disaster> disasters;
  final List<SafeZone> safeZones;
  final List<ResourceItem> resources;
  final SafeZone? nearestSafeZone;
  final LatLng? currentLocation;
}

class ResourcesBundle {
  const ResourcesBundle({required this.resources, required this.requests});

  final List<ResourceItem> resources;
  final List<ResourceRequestItem> requests;
}

class SosBundle {
  const SosBundle({required this.signals, this.currentLocation});

  final List<SosSignal> signals;
  final LatLng? currentLocation;
}

class DashboardStats {
  const DashboardStats({
    required this.activeDisasters,
    required this.pendingSos,
    required this.totalResources,
    required this.totalSafeZones,
    required this.totalUsers,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      activeDisasters: json['activeDisasters'] as int? ?? 0,
      pendingSos: json['pendingSOS'] as int? ?? 0,
      totalResources: json['totalResources'] as int? ?? 0,
      totalSafeZones: json['totalSafeZones'] as int? ?? 0,
      totalUsers: json['totalUsers'] as int? ?? 0,
    );
  }

  final int activeDisasters;
  final int pendingSos;
  final int totalResources;
  final int totalSafeZones;
  final int totalUsers;
}

class Disaster {
  const Disaster({
    required this.id,
    required this.title,
    required this.type,
    required this.severity,
    required this.status,
    this.description,
    this.affectedArea,
    this.centerPoint,
    this.secondaryRisks = const [],
    this.createdAt,
  });

  factory Disaster.fromJson(Map<String, dynamic> json) {
    return Disaster(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'Untitled disaster',
      description: json['description'] as String?,
      type: json['type'] as String? ?? 'unknown',
      severity: json['severity'] as String? ?? 'unknown',
      status: json['status'] as String? ?? 'unknown',
      affectedArea: json['affectedArea'] as String?,
      centerPoint: json['centerPoint'] as String?,
      secondaryRisks: (json['secondaryRisks'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      createdAt: json['createdAt'] as String?,
    );
  }

  final String id;
  final String title;
  final String? description;
  final String type;
  final String severity;
  final String status;
  final String? affectedArea;
  final String? centerPoint;
  final List<String> secondaryRisks;
  final String? createdAt;
}

class SafeZone {
  const SafeZone({
    required this.id,
    required this.name,
    required this.capacity,
    required this.currentOccupancy,
    this.location,
    this.boundary,
    this.amenities = const [],
    this.status,
  });

  factory SafeZone.fromJson(Map<String, dynamic> json) {
    return SafeZone(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Unnamed safe zone',
      capacity: json['capacity'] as int? ?? 0,
      currentOccupancy: json['currentOccupancy'] as int? ?? 0,
      location: json['location'] as String?,
      boundary: json['boundary'] as String?,
      amenities: (json['amenities'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      status: json['status'] as String?,
    );
  }

  final String id;
  final String name;
  final int capacity;
  final int currentOccupancy;
  final String? location;
  final String? boundary;
  final List<String> amenities;
  final String? status;

  double get occupancyRate {
    if (capacity == 0) return 0;
    return currentOccupancy / capacity;
  }
}

class ResourceItem {
  const ResourceItem({
    required this.id,
    required this.name,
    this.category,
    this.quantity,
    this.unit,
    this.status,
    this.location,
    this.managedBy,
  });

  factory ResourceItem.fromJson(Map<String, dynamic> json) {
    return ResourceItem(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Unnamed resource',
      category: json['category'] as String?,
      quantity: json['quantity'] as int?,
      unit: json['unit'] as String?,
      status: json['status'] as String?,
      location: json['location'] as String?,
      managedBy: json['managedBy'] as String?,
    );
  }

  final String id;
  final String name;
  final String? category;
  final int? quantity;
  final String? unit;
  final String? status;
  final String? location;
  final String? managedBy;
}

class ResourceRequestItem {
  const ResourceRequestItem({
    required this.id,
    this.requestedBy,
    this.resourceId,
    this.resourceName,
    this.quantityNeeded,
    this.urgency,
    this.status,
    this.fulfilledBy,
    this.location,
    this.createdAt,
  });

  factory ResourceRequestItem.fromJson(Map<String, dynamic> json) {
    return ResourceRequestItem(
      id: json['id'] as String,
      requestedBy: json['requestedBy'] as String?,
      resourceId: json['resourceId'] as String?,
      resourceName: json['resourceName'] as String?,
      quantityNeeded: json['quantityNeeded'] as int?,
      urgency: json['urgency'] as String?,
      status: json['status'] as String?,
      fulfilledBy: json['fulfilledBy'] as String?,
      location: json['location'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }

  final String id;
  final String? requestedBy;
  final String? resourceId;
  final String? resourceName;
  final int? quantityNeeded;
  final String? urgency;
  final String? status;
  final String? fulfilledBy;
  final String? location;
  final String? createdAt;
}

class ProfileSummary {
  const ProfileSummary({
    required this.id,
    this.fullName,
    this.phone,
    this.distance,
  });

  factory ProfileSummary.fromJson(Map<String, dynamic> json) {
    return ProfileSummary(
      id: json['id'] as String,
      fullName: json['fullName'] as String?,
      phone: json['phone'] as String?,
      distance: (json['distance'] as num?)?.toDouble(),
    );
  }

  final String id;
  final String? fullName;
  final String? phone;
  final double? distance;
}

class SosSignal {
  const SosSignal({
    required this.id,
    this.senderId,
    this.location,
    this.type,
    this.description,
    this.status,
    this.assignedTo,
    this.createdAt,
    this.resolvedAt,
    this.nearestResponders = const [],
  });

  factory SosSignal.fromJson(Map<String, dynamic> json) {
    return SosSignal(
      id: json['id'] as String,
      senderId: json['senderId'] as String?,
      location: json['location'] as String?,
      type: json['type'] as String?,
      description: json['description'] as String?,
      status: json['status'] as String?,
      assignedTo: json['assignedTo'] as String?,
      createdAt: json['createdAt'] as String?,
      resolvedAt: json['resolvedAt'] as String?,
      nearestResponders:
          (json['nearestResponders'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(ProfileSummary.fromJson)
              .toList(),
    );
  }

  final String id;
  final String? senderId;
  final String? location;
  final String? type;
  final String? description;
  final String? status;
  final String? assignedTo;
  final String? createdAt;
  final String? resolvedAt;
  final List<ProfileSummary> nearestResponders;
}

class NewsUpdate {
  const NewsUpdate({
    required this.id,
    required this.title,
    required this.content,
    this.category,
    this.createdAt,
  });

  factory NewsUpdate.fromJson(Map<String, dynamic> json) {
    return NewsUpdate(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'Untitled update',
      content: json['content'] as String? ?? '',
      category: json['category'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }

  final String id;
  final String title;
  final String content;
  final String? category;
  final String? createdAt;
}

class AiAuditRef {
  const AiAuditRef({
    required this.id,
    required this.action,
    required this.model,
    required this.status,
    required this.createdAt,
    this.reviewStatus,
  });

  factory AiAuditRef.fromJson(Map<String, dynamic> json) {
    return AiAuditRef(
      id: json['id'] as String? ?? '',
      action: json['action'] as String? ?? '',
      model: json['model'] as String? ?? '',
      status: json['status'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      reviewStatus: json['reviewStatus'] as String?,
    );
  }

  final String id;
  final String action;
  final String model;
  final String status;
  final String createdAt;
  final String? reviewStatus;
}

class AiResponseMeta {
  const AiResponseMeta({
    required this.status,
    required this.confidence,
    required this.sourceIds,
    required this.warnings,
    required this.requiresHumanApproval,
    required this.audit,
  });

  factory AiResponseMeta.fromJson(Map<String, dynamic> json) {
    return AiResponseMeta(
      status: json['status'] as String? ?? 'unknown',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      sourceIds: (json['sourceIds'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      warnings: (json['warnings'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      requiresHumanApproval:
          json['requiresHumanApproval'] as bool? ?? false,
      audit: AiAuditRef.fromJson(
        (json['audit'] as Map<String, dynamic>? ?? const {}),
      ),
    );
  }

  final String status;
  final double confidence;
  final List<String> sourceIds;
  final List<String> warnings;
  final bool requiresHumanApproval;
  final AiAuditRef audit;
}

class CitizenAiGuidance {
  const CitizenAiGuidance({
    required this.title,
    required this.nextSteps,
    required this.guidance,
    required this.meta,
    this.safeZoneId,
    this.resourceIds = const [],
  });

  factory CitizenAiGuidance.fromJson(Map<String, dynamic> json) {
    final guidance = json['guidance'] as Map<String, dynamic>? ?? const {};
    return CitizenAiGuidance(
      title: json['title'] as String? ?? 'Safety guidance',
      safeZoneId: json['safeZoneId'] as String?,
      resourceIds: (json['resourceIds'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      nextSteps: (json['nextSteps'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      guidance: AiTranslationSet.fromJson(guidance),
      meta: AiResponseMeta.fromJson(
        (json['meta'] as Map<String, dynamic>? ?? const {}),
      ),
    );
  }

  final String title;
  final String? safeZoneId;
  final List<String> resourceIds;
  final List<String> nextSteps;
  final AiTranslationSet guidance;
  final AiResponseMeta meta;
}

class PreparedSos {
  const PreparedSos({
    required this.original,
    required this.refined,
    required this.checklist,
    required this.translations,
    required this.meta,
  });

  factory PreparedSos.fromJson(Map<String, dynamic> json) {
    return PreparedSos(
      original: json['original'] as String? ?? '',
      refined: json['refined'] as String? ?? '',
      checklist: (json['checklist'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      translations: AiTranslationSet.fromJson(
        (json['translations'] as Map<String, dynamic>? ?? const {}),
      ),
      meta: AiResponseMeta.fromJson(
        (json['meta'] as Map<String, dynamic>? ?? const {}),
      ),
    );
  }

  final String original;
  final String refined;
  final List<String> checklist;
  final AiTranslationSet translations;
  final AiResponseMeta meta;
}

class AiTranslationSet {
  const AiTranslationSet({
    required this.english,
    required this.sinhala,
    required this.tamil,
  });

  factory AiTranslationSet.fromJson(Map<String, dynamic> json) {
    return AiTranslationSet(
      english: json['english'] as String? ?? '',
      sinhala: json['sinhala'] as String? ?? '',
      tamil: json['tamil'] as String? ?? '',
    );
  }

  final String english;
  final String sinhala;
  final String tamil;
}

class GeoJsonPoint {
  const GeoJsonPoint({required this.longitude, required this.latitude});

  final double longitude;
  final double latitude;

  LatLng get latLng => LatLng(latitude, longitude);
}

class GeoJsonPolygon {
  const GeoJsonPolygon({required this.points});

  final List<LatLng> points;
}

class GeoJsonCodec {
  const GeoJsonCodec._();

  static GeoJsonPoint? decodePoint(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final json = jsonDecode(raw);
    if (json is! Map<String, dynamic> || json['type'] != 'Point') return null;
    final coordinates = json['coordinates'] as List<dynamic>? ?? const [];
    if (coordinates.length < 2) return null;
    return GeoJsonPoint(
      longitude: (coordinates[0] as num).toDouble(),
      latitude: (coordinates[1] as num).toDouble(),
    );
  }

  static GeoJsonPolygon? decodePolygon(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final json = jsonDecode(raw);
    if (json is! Map<String, dynamic>) return null;

    final type = json['type'];
    if (type == 'Polygon') {
      return GeoJsonPolygon(points: _decodeRing(json['coordinates']));
    }

    if (type == 'MultiPolygon') {
      final polygons = json['coordinates'] as List<dynamic>? ?? const [];
      if (polygons.isEmpty) return null;
      return GeoJsonPolygon(points: _decodeRing(polygons.first));
    }

    return null;
  }

  static GeoJsonPoint fromPosition(Position position) {
    return GeoJsonPoint(
      longitude: position.longitude,
      latitude: position.latitude,
    );
  }

  static String encodePoint(GeoJsonPoint point) {
    return jsonEncode({
      'type': 'Point',
      'coordinates': [point.longitude, point.latitude],
    });
  }

  static List<LatLng> _decodeRing(dynamic rawCoordinates) {
    final coordinates = rawCoordinates as List<dynamic>? ?? const [];
    if (coordinates.isEmpty) return const [];
    final ring = coordinates.first as List<dynamic>? ?? const [];
    return ring
        .whereType<List<dynamic>>()
        .where((pair) => pair.length >= 2)
        .map(
          (pair) =>
              LatLng((pair[1] as num).toDouble(), (pair[0] as num).toDouble()),
        )
        .toList();
  }
}

class AppGraphQL {
  const AppGraphQL._();

  static const getDisasters = '''
    query GetDisasters(\$status: String) {
      getDisasters(status: \$status) {
        id
        title
        description
        type
        severity
        status
        affectedArea
        centerPoint
        secondaryRisks
        createdAt
      }
    }
  ''';

  static const getSafeZones = '''
    query GetSafeZones(\$disasterId: ID) {
      getSafeZones(disasterId: \$disasterId) {
        id
        name
        location
        boundary
        capacity
        currentOccupancy
        amenities
        status
      }
    }
  ''';

  static const getNearestSafeZone = '''
    query GetNearestSafeZone(\$lat: Float!, \$lon: Float!) {
      getNearestSafeZone(lat: \$lat, lon: \$lon) {
        id
        name
        location
        boundary
        capacity
        currentOccupancy
        amenities
        status
      }
    }
  ''';

  static const getResources = '''
    query GetResources(\$disasterId: ID, \$category: String) {
      getResources(disasterId: \$disasterId, category: \$category) {
        id
        name
        category
        quantity
        unit
        status
        location
        managedBy
      }
    }
  ''';

  static const getDashboardStats = '''
    query GetDashboardStats {
      getDashboardStats {
        activeDisasters
        pendingSOS
        totalResources
        totalSafeZones
        totalUsers
      }
    }
  ''';

  static const getNewsUpdates = '''
    query GetNewsUpdates(\$disasterId: ID) {
      getNewsUpdates(disasterId: \$disasterId) {
        id
        title
        content
        category
        createdAt
      }
    }
  ''';

  static const getCitizenGuidance = '''
    query GetCitizenGuidance(\$disasterId: ID) {
      getCitizenGuidance(disasterId: \$disasterId) {
        title
        safeZoneId
        resourceIds
        nextSteps
        guidance {
          english
          sinhala
          tamil
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
        }
      }
    }
  ''';

  static const getMyResourceRequests = '''
    query GetMyResourceRequests(\$status: String) {
      getMyResourceRequests(status: \$status) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        location
        createdAt
      }
    }
  ''';

  static const getMySosSignals = '''
    query GetMySOSSignals(\$status: String) {
      getMySOSSignals(status: \$status) {
        id
        senderId
        location
        type
        description
        status
        assignedTo
        createdAt
        resolvedAt
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  ''';

  static const requestResource = '''
    mutation RequestResource(\$input: ResourceRequestInput!) {
      requestResource(input: \$input) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        location
        createdAt
      }
    }
  ''';

  static const createSos = '''
    mutation CreateSOS(\$input: SOSInput!) {
      createSOS(input: \$input) {
        id
        senderId
        location
        type
        description
        status
        assignedTo
        createdAt
        resolvedAt
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  ''';

  static const prepareSosSubmission = '''
    mutation PrepareSosSubmission(\$input: AiPrepareSosInput!) {
      prepareSosSubmission(input: \$input) {
        original
        refined
        checklist
        translations {
          english
          sinhala
          tamil
        }
        meta {
          status
          confidence
          sourceIds
          warnings
          requiresHumanApproval
          audit {
            id
            action
            model
            status
            createdAt
            reviewStatus
          }
        }
      }
    }
  ''';

  static const onNewNews = '''
    subscription OnNewNews {
      onNewNews {
        id
        title
        content
        category
        createdAt
      }
    }
  ''';

  static const onResourceUpdate = '''
    subscription OnResourceUpdate {
      onResourceUpdate {
        id
        name
        category
        quantity
        unit
        status
        location
        managedBy
      }
    }
  ''';

  static const onMyResourceRequestUpdate = '''
    subscription OnMyResourceRequestUpdate(\$requestedBy: String!) {
      onMyResourceRequestUpdate(requestedBy: \$requestedBy) {
        id
        requestedBy
        resourceId
        resourceName
        quantityNeeded
        urgency
        status
        fulfilledBy
        location
        createdAt
      }
    }
  ''';

  static const onMySosUpdate = '''
    subscription OnMySOSUpdate(\$senderId: String!) {
      onMySOSUpdate(senderId: \$senderId) {
        id
        senderId
        location
        type
        description
        status
        assignedTo
        createdAt
        resolvedAt
        nearestResponders {
          id
          fullName
          phone
          distance
        }
      }
    }
  ''';
}

class AmplifyBackend {
  AmplifyBackend._();

  static final AmplifyBackend instance = AmplifyBackend._();

  AppConfig config = const AppConfig.empty();
  final AmplifyAuthCognito _auth = AmplifyAuthCognito();
  final AmplifyAPI _api = AmplifyAPI();

  bool _configured = false;

  Future<void> initialize() async {
    config = await AppConfig.load();
  }

  Future<void> configure() async {
    if (!config.isConfigured || _configured) return;

    try {
      await Amplify.addPlugins([_auth, _api]);
      await Amplify.configure(config.amplifyOutputsJson);
    } on AmplifyAlreadyConfiguredException {
      safePrint('Amplify was already configured.');
    }

    _configured = true;
  }

  Future<AppSession> restoreSession() async {
    if (!config.isConfigured) {
      return const AppSession(isConfigured: false, isSignedIn: false);
    }

    await configure();

    try {
      final session = await Amplify.Auth.fetchAuthSession();
      if (!session.isSignedIn) {
        return const AppSession(isConfigured: true, isSignedIn: false);
      }

      final cognitoSession = session as CognitoAuthSession;
      final user = await Amplify.Auth.getCurrentUser();
      final groups = _extractGroups(cognitoSession);
      return AppSession(
        isConfigured: true,
        isSignedIn: true,
        userId: cognitoSession.userSubResult.valueOrNull,
        username: user.username,
        groups: groups,
      );
    } on AuthException {
      return const AppSession(isConfigured: true, isSignedIn: false);
    }
  }

  Future<AppSession> signIn({
    required String username,
    required String password,
  }) async {
    await configure();
    final result = await Amplify.Auth.signIn(
      username: username,
      password: password,
      options: const SignInOptions(
        pluginOptions: CognitoSignInPluginOptions(
          authFlowType: AuthenticationFlowType.userSrpAuth,
        ),
      ),
    );

    if (!result.isSignedIn &&
        result.nextStep.signInStep ==
            AuthSignInStep.confirmSignInWithNewPassword) {
      throw const NewPasswordRequiredException();
    }

    if (!result.isSignedIn &&
        result.nextStep.signInStep != AuthSignInStep.done) {
      throw Exception(
        'Cognito returned an unsupported sign-in step: ${result.nextStep.signInStep.name}.',
      );
    }

    return restoreSession();
  }

  Future<AppSession> completeNewPassword({required String newPassword}) async {
    await configure();
    final result = await Amplify.Auth.confirmSignIn(
      confirmationValue: newPassword,
    );

    if (!result.isSignedIn &&
        result.nextStep.signInStep != AuthSignInStep.done) {
      throw Exception(
        'Cognito returned an unsupported sign-in step: ${result.nextStep.signInStep.name}.',
      );
    }

    return restoreSession();
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    await configure();
    final attributes = <AuthUserAttributeKey, String>{
      AuthUserAttributeKey.email: email,
      CognitoUserAttributeKey.custom('role'): 'citizen',
      if (fullName.isNotEmpty) AuthUserAttributeKey.name: fullName,
      if (phone != null && phone.isNotEmpty)
        AuthUserAttributeKey.phoneNumber: phone,
    };

    await Amplify.Auth.signUp(
      username: email,
      password: password,
      options: SignUpOptions(userAttributes: attributes),
    );
  }

  Future<void> confirmSignUp({
    required String username,
    required String code,
  }) async {
    await configure();
    await Amplify.Auth.confirmSignUp(
      username: username,
      confirmationCode: code,
    );
  }

  Future<void> signOut() async {
    if (!config.isConfigured) return;
    await Amplify.Auth.signOut();
  }

  Future<dynamic> queryRoot(
    String document,
    String rootKey, {
    Map<String, dynamic> variables = const {},
  }) async {
    await configure();
    final request = GraphQLRequest<String>(
      apiName: config.apiName,
      document: document,
      variables: variables,
      authorizationMode: APIAuthorizationType.userPools,
    );
    final response = await Amplify.API.query(request: request).response;
    _throwIfErrors(response.errors);
    return _rootValue(response.data, rootKey);
  }

  Future<dynamic> mutateRoot(
    String document,
    String rootKey, {
    Map<String, dynamic> variables = const {},
  }) async {
    await configure();
    final request = GraphQLRequest<String>(
      apiName: config.apiName,
      document: document,
      variables: variables,
      authorizationMode: APIAuthorizationType.userPools,
    );
    final response = await Amplify.API.mutate(request: request).response;
    _throwIfErrors(response.errors);
    return _rootValue(response.data, rootKey);
  }

  Stream<dynamic> subscribeRoot(
    String document,
    String rootKey, {
    Map<String, dynamic> variables = const {},
    void Function()? onEstablished,
  }) {
    final request = GraphQLRequest<String>(
      apiName: config.apiName,
      document: document,
      variables: variables,
      authorizationMode: APIAuthorizationType.userPools,
    );

    return Amplify.API
        .subscribe<String>(request, onEstablished: onEstablished)
        .map((response) {
          _throwIfErrors(response.errors);
          return _rootValue(response.data, rootKey);
        });
  }

  Future<Position?> getCurrentPosition({bool forcePrompt = false}) async {
    try {
      final servicesEnabled = await Geolocator.isLocationServiceEnabled();
      if (!servicesEnabled) return null;

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || forcePrompt) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }

      return await Geolocator.getCurrentPosition().timeout(
        const Duration(seconds: 8),
      );
    } on TimeoutException {
      return null;
    } catch (_) {
      return null;
    }
  }

  List<String> _extractGroups(CognitoAuthSession session) {
    final tokens = session.userPoolTokensResult.valueOrNull;
    final groupsClaim = tokens?.idToken.claims.customClaims['cognito:groups'];
    if (groupsClaim is List) {
      return groupsClaim.map((item) => item.toString()).toList();
    }
    if (groupsClaim is String && groupsClaim.isNotEmpty) {
      return groupsClaim.split(',');
    }
    return const [];
  }

  dynamic _rootValue(String? rawData, String rootKey) {
    if (rawData == null) return null;
    final decoded = jsonDecode(rawData);
    if (decoded is! Map<String, dynamic>) return null;
    return decoded[rootKey];
  }

  void _throwIfErrors(List<GraphQLResponseError> errors) {
    if (errors.isEmpty) return;
    final message = errors.map((error) => error.message).join('\n');
    throw Exception(message);
  }
}

class CitizenRepository {
  CitizenRepository(this._backend);

  final AmplifyBackend _backend;

  Future<DashboardBundle> loadDashboard() async {
    final results = await Future.wait<dynamic>([
      _backend.queryRoot(AppGraphQL.getDashboardStats, 'getDashboardStats'),
      _queryRootOrDefault(
        AppGraphQL.getDisasters,
        'getDisasters',
        defaultValue: const [],
        variables: const {'status': 'active'},
      ),
      _queryRootOrDefault(
        AppGraphQL.getSafeZones,
        'getSafeZones',
        defaultValue: const [],
      ),
      _backend.queryRoot(AppGraphQL.getNewsUpdates, 'getNewsUpdates'),
      _backend.getCurrentPosition(),
    ]);

    final position = results[4] as Position?;
    final nearest = await _loadNearestSafeZone(position);

    return DashboardBundle(
      stats: DashboardStats.fromJson(results[0] as Map<String, dynamic>),
      disasters: _mapList(results[1], Disaster.fromJson),
      safeZones: _mapList(results[2], SafeZone.fromJson),
      news: _mapList(results[3], NewsUpdate.fromJson),
      nearestSafeZone: nearest,
    );
  }

  Future<MapBundle> loadMapData() async {
    final results = await Future.wait<dynamic>([
      _queryRootOrDefault(
        AppGraphQL.getDisasters,
        'getDisasters',
        defaultValue: const [],
        variables: const {'status': 'active'},
      ),
      _queryRootOrDefault(
        AppGraphQL.getSafeZones,
        'getSafeZones',
        defaultValue: const [],
      ),
      _backend.queryRoot(AppGraphQL.getResources, 'getResources'),
      _backend.getCurrentPosition(),
    ]);

    final position = results[3] as Position?;
    final nearest = await _loadNearestSafeZone(position);

    return MapBundle(
      disasters: _mapList(results[0], Disaster.fromJson),
      safeZones: _mapList(results[1], SafeZone.fromJson),
      resources: _mapList(results[2], ResourceItem.fromJson),
      nearestSafeZone: nearest,
      currentLocation: position == null
          ? null
          : LatLng(position.latitude, position.longitude),
    );
  }

  Future<List<NewsUpdate>> loadNews() async {
    final result = await _backend.queryRoot(
      AppGraphQL.getNewsUpdates,
      'getNewsUpdates',
    );
    return _mapList(result, NewsUpdate.fromJson);
  }

  Future<CitizenAiGuidance> loadCitizenGuidance({String? disasterId}) async {
    try {
      final result = await _backend.queryRoot(
        AppGraphQL.getCitizenGuidance,
        'getCitizenGuidance',
        variables: {'disasterId': disasterId},
      );
      return CitizenAiGuidance.fromJson(result as Map<String, dynamic>);
    } catch (error) {
      throw Exception(
        "Unable to load live AI safety guidance. ${error.toString().replaceFirst('Exception: ', '')}",
      );
    }
  }


  Future<ResourcesBundle> loadResourcesBundle() async {
    final results = await Future.wait<dynamic>([
      _backend.queryRoot(AppGraphQL.getResources, 'getResources'),
      _queryRootOrDefault(
        AppGraphQL.getMyResourceRequests,
        'getMyResourceRequests',
        defaultValue: const [],
      ),
    ]);
    return ResourcesBundle(
      resources: _mapList(results[0], ResourceItem.fromJson),
      requests: _mapList(results[1], ResourceRequestItem.fromJson),
    );
  }

  Future<SosBundle> loadSosBundle() async {
    final results = await Future.wait<dynamic>([
      _queryRootOrDefault(
        AppGraphQL.getMySosSignals,
        'getMySOSSignals',
        defaultValue: const [],
      ),
      _backend.getCurrentPosition(),
    ]);
    final position = results[1] as Position?;
    return SosBundle(
      signals: _mapList(results[0], SosSignal.fromJson),
      currentLocation: position == null
          ? null
          : LatLng(position.latitude, position.longitude),
    );
  }

  Future<ResourceRequestItem> requestResource({
    String? resourceId,
    required String resourceName,
    required int quantityNeeded,
    required String urgency,
  }) async {
    final position = await _backend.getCurrentPosition(forcePrompt: true);
    final location = position == null
        ? null
        : GeoJsonCodec.encodePoint(GeoJsonCodec.fromPosition(position));
    final result = await _backend.mutateRoot(
      AppGraphQL.requestResource,
      'requestResource',
      variables: {
        'input': {
          'resourceId': resourceId,
          'resourceName': resourceName,
          'quantityNeeded': quantityNeeded,
          'urgency': urgency,
          'location': location,
        },
      },
    );
    return ResourceRequestItem.fromJson(result as Map<String, dynamic>);
  }

  Future<SosSignal> createSos({
    required String type,
    String? description,
  }) async {
    final position = await _backend.getCurrentPosition(forcePrompt: true);
    if (position == null) {
      throw Exception('Location permission is required to send an SOS.');
    }

    final location = GeoJsonCodec.encodePoint(
      GeoJsonCodec.fromPosition(position),
    );
    final result = await _mutateRootOrFallback(
      AppGraphQL.createSos,
      'createSOS',
      variables: {
        'input': {
          'type': type,
          'description': description,
          'location': location,
        },
      },
      fallback: () => _buildSyntheticSos(
        type: type,
        description: description,
        location: location,
      ),
    );
    return SosSignal.fromJson(result as Map<String, dynamic>);
  }

  Future<PreparedSos> prepareSosSubmission({
    required String type,
    required String description,
  }) async {
    try {
      final result = await _backend.mutateRoot(
        AppGraphQL.prepareSosSubmission,
        'prepareSosSubmission',
        variables: {
          'input': {'type': type, 'description': description},
        },
      );
      return PreparedSos.fromJson(result as Map<String, dynamic>);
    } catch (error) {
      throw Exception(
        "Unable to prepare SOS with live AI. ${error.toString().replaceFirst('Exception: ', '')}",
      );
    }
  }


  Stream<NewsUpdate> subscribeToNews() {
    return _backend
        .subscribeRoot(AppGraphQL.onNewNews, 'onNewNews')
        .map((data) => NewsUpdate.fromJson(data as Map<String, dynamic>));
  }

  Stream<ResourceItem> subscribeToResourceUpdates() {
    return _backend
        .subscribeRoot(AppGraphQL.onResourceUpdate, 'onResourceUpdate')
        .map((data) => ResourceItem.fromJson(data as Map<String, dynamic>));
  }

  Stream<ResourceRequestItem> subscribeToMyRequestUpdates(String userId) {
    return _backend
        .subscribeRoot(
          AppGraphQL.onMyResourceRequestUpdate,
          'onMyResourceRequestUpdate',
          variables: {'requestedBy': userId},
        )
        .map(
          (data) => ResourceRequestItem.fromJson(data as Map<String, dynamic>),
        );
  }

  Stream<SosSignal> subscribeToMySosUpdates(String userId) {
    return _backend
        .subscribeRoot(
          AppGraphQL.onMySosUpdate,
          'onMySOSUpdate',
          variables: {'senderId': userId},
        )
        .map((data) => SosSignal.fromJson(data as Map<String, dynamic>));
  }

  Future<SafeZone?> _loadNearestSafeZone(Position? position) async {
    if (position == null) return null;
    try {
      final result = await _backend.queryRoot(
        AppGraphQL.getNearestSafeZone,
        'getNearestSafeZone',
        variables: {'lat': position.latitude, 'lon': position.longitude},
      );
      if (result == null) return null;
      return SafeZone.fromJson(result as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _queryRootOrDefault(
    String document,
    String rootKey, {
    required dynamic defaultValue,
    Map<String, dynamic> variables = const {},
  }) async {
    try {
      return await _backend.queryRoot(document, rootKey, variables: variables);
    } catch (error) {
      final message = error.toString();
      if (_isNullableResolverMismatch(message, rootKey)) {
        return defaultValue;
      }
      rethrow;
    }
  }

  Future<dynamic> _mutateRootOrFallback(
    String document,
    String rootKey, {
    required FutureOr<dynamic> Function() fallback,
    Map<String, dynamic> variables = const {},
  }) async {
    try {
      return await _backend.mutateRoot(document, rootKey, variables: variables);
    } catch (error) {
      final message = error.toString();
      if (_isNullableResolverMismatch(message, rootKey)) {
        return await fallback();
      }
      rethrow;
    }
  }

  Map<String, dynamic> _buildSyntheticSos({
    required String type,
    String? description,
    required String location,
  }) {
    return {
      'id': 'pending-${DateTime.now().millisecondsSinceEpoch}',
      'senderId': null,
      'location': location,
      'type': type,
      'description': description,
      'status': 'pending',
      'assignedTo': null,
      'createdAt': DateTime.now().toIso8601String(),
      'resolvedAt': null,
      'nearestResponders': const [],
    };
  }

  bool _isNullableResolverMismatch(String message, String rootKey) {
    return message.contains(rootKey) &&
        message.contains('Cannot return null for non-nullable type');
  }

  List<T> _mapList<T>(
    dynamic value,
    T Function(Map<String, dynamic> json) fromJson,
  ) {
    final list = value as List<dynamic>? ?? const [];
    return list.whereType<Map<String, dynamic>>().map(fromJson).toList();
  }
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
  static const error = Color(0xFFBA1A1A);
}

