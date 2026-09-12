import 'package:crisisconnect_citizen/core/sos_confirmation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('only a server UUID confirms SOS submission', () {
    const response = {
      'id': '9d7be093-4f84-405f-87fb-5de36c49993b',
      'status': 'pending',
    };
    expect(requireSosConfirmation(response), same(response));
  });

  test(
    'missing, partial and synthetic responses preserve unconfirmed status',
    () {
      for (final response in [
        null,
        <String, dynamic>{},
        {'id': ''},
        {'id': 'pending-123456'},
        {'id': 42},
      ]) {
        expect(
          () => requireSosConfirmation(response),
          throwsA(
            predicate((error) => error.toString().contains('not confirmed')),
          ),
        );
      }
    },
  );
}
