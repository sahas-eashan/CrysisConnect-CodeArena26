import 'package:flutter_test/flutter_test.dart';

import 'package:crisisconnect_citizen/main.dart';

void main() {
  testWidgets('renders citizen dashboard shell', (WidgetTester tester) async {
    await tester.pumpWidget(const CrisisConnectApp());

    expect(find.text('CrisisConnect'), findsOneWidget);
    expect(find.text('Heavy Rain & Landslide Warning'), findsOneWidget);
    expect(find.text('GET ME TO SAFETY'), findsOneWidget);
  });
}
