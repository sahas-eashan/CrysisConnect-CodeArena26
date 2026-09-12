/// The backend uses UUIDs. Local placeholders and empty responses cannot confirm delivery.
Map<String, dynamic> requireSosConfirmation(dynamic response) {
  final id = response is Map<String, dynamic> ? response['id'] : null;
  if (id is! String ||
      !RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      ).hasMatch(id)) {
    throw Exception(
      'SOS submission was not confirmed by the server. Your details are retained. Check My SOS before retrying.',
    );
  }
  return response as Map<String, dynamic>;
}
