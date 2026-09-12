import 'package:flutter_test/flutter_test.dart';

import 'package:crisisconnect_citizen/app/app.dart';

void main() {
  testWidgets('shows missing config state without dart defines', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const CrisisConnectApp());
    await tester.pumpAndSettle();

    expect(find.text('Backend config required'), findsOneWidget);
    expect(find.textContaining('CRISIS_AWS_REGION'), findsOneWidget);
  });
}
