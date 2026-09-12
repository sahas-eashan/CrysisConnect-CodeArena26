import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/app/app.dart';
import 'package:flutter/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AmplifyBackend.instance.initialize();
  runApp(const CrisisConnectApp());
}
