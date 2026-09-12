import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/features/citizen/citizen_shell.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final AmplifyBackend _backend = AmplifyBackend.instance;

  bool _loading = true;
  String? _error;
  AppSession _session = const AppSession(
    isConfigured: false,
    isSignedIn: false,
  );

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final session = await _backend.restoreSession();
      if (!mounted) return;
      setState(() {
        _session = session;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _signOut() async {
    await _backend.signOut();
    await _restore();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      final l10n = AppLocalizations.of(context);
      return _LoadingScaffold(
        message: l10n?.connectingMessage ?? 'Connecting to CrisisConnect...',
      );
    }

    if (!_session.isConfigured) {
      return const _MissingConfigScreen();
    }

    if (_error != null) {
      return _ErrorScaffold(message: _error!, onRetry: _restore);
    }

    if (!_session.isSignedIn) {
      return AuthScreen(
        backend: _backend,
        onSignedIn: (session) {
          setState(() {
            _session = session;
          });
        },
      );
    }

    return CitizenShell(
      session: _session,
      repository: CitizenRepository(_backend),
      onSignOut: _signOut,
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({
    super.key,
    required this.backend,
    required this.onSignedIn,
  });

  final AmplifyBackend backend;
  final ValueChanged<AppSession> onSignedIn;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

enum _AuthMode { signIn, signUp, confirm, newPassword }

class _AuthScreenState extends State<AuthScreen> {
  _AuthMode _mode = _AuthMode.signIn;
  bool _busy = false;
  String? _message;
  String? _error;
  String _pendingUsername = '';

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignIn() async {
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });

    try {
      final session = await widget.backend.signIn(
        username: _emailController.text.trim(),
        password: _passwordController.text,
      );
      if (!mounted) return;
      widget.onSignedIn(session);
    } on NewPasswordRequiredException catch (error) {
      if (!mounted) return;
      _newPasswordController.clear();
      setState(() {
        _mode = _AuthMode.newPassword;
        _message = error.toString();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _handleSignUp() async {
    await _run(() async {
      final email = _emailController.text.trim();
      await widget.backend.signUp(
        email: email,
        password: _passwordController.text,
        fullName: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _pendingUsername = email;
        _mode = _AuthMode.confirm;
        _message = 'Confirmation code sent to your email address.';
      });
    });
  }

  Future<void> _handleConfirm() async {
    await _run(() async {
      await widget.backend.confirmSignUp(
        username: _pendingUsername.isEmpty
            ? _emailController.text.trim()
            : _pendingUsername,
        code: _codeController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _mode = _AuthMode.signIn;
        _message = 'Registration confirmed. Sign in to continue.';
      });
    });
  }

  Future<void> _handleCompleteNewPassword() async {
    await _run(() async {
      final session = await widget.backend.completeNewPassword(
        newPassword: _newPasswordController.text,
      );
      widget.onSignedIn(session);
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });

    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    final title = switch (_mode) {
      _AuthMode.signIn => l10n.signInTitle,
      _AuthMode.signUp => l10n.signUpTitle,
      _AuthMode.confirm => l10n.confirmTitle,
      _AuthMode.newPassword => l10n.newPasswordTitle,
    };

    final description = switch (_mode) {
      _AuthMode.signIn => l10n.signInDesc,
      _AuthMode.signUp => l10n.signUpDesc,
      _AuthMode.confirm => l10n.confirmDesc,
      _AuthMode.newPassword => l10n.newPasswordDesc,
    };

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLowest,
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      blurRadius: 34,
                      offset: const Offset(0, 16),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.shield_rounded,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      title,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.surfaceVariantText,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (_mode == _AuthMode.signUp) ...[
                      TextField(
                        controller: _nameController,
                        textCapitalization: TextCapitalization.words,
                        decoration: InputDecoration(
                          labelText: l10n.fullName,
                          prefixIcon: const Icon(Icons.person_outline_rounded),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_mode != _AuthMode.confirm &&
                        _mode != _AuthMode.newPassword) ...[
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: l10n.emailLabel,
                          prefixIcon: const Icon(Icons.email_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_mode == _AuthMode.signUp) ...[
                      TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: l10n.phoneNumber,
                          prefixIcon: const Icon(Icons.phone_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_mode == _AuthMode.confirm)
                      TextField(
                        controller: _codeController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: l10n.confirmationCode,
                          prefixIcon: const Icon(Icons.verified_outlined),
                        ),
                      )
                    else if (_mode == _AuthMode.newPassword)
                      TextField(
                        controller: _newPasswordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText: l10n.newPassword,
                          prefixIcon: const Icon(Icons.lock_reset_rounded),
                        ),
                      )
                    else
                      TextField(
                        controller: _passwordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          labelText: l10n.passwordLabel,
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                        ),
                      ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _busy
                            ? null
                            : switch (_mode) {
                                _AuthMode.signIn => _handleSignIn,
                                _AuthMode.signUp => _handleSignUp,
                                _AuthMode.confirm => _handleConfirm,
                                _AuthMode.newPassword =>
                                  _handleCompleteNewPassword,
                              },
                        child: Text(
                          _busy
                              ? l10n.pleaseWait
                              : switch (_mode) {
                                  _AuthMode.signIn => l10n.signInButton,
                                  _AuthMode.signUp => l10n.signUpButton,
                                  _AuthMode.confirm => l10n.confirmButton,
                                  _AuthMode.newPassword =>
                                    l10n.savePasswordButton,
                                },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_mode == _AuthMode.signIn)
                      Center(
                        child: TextButton(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                  _mode = _AuthMode.signUp;
                                  _error = null;
                                  _message = null;
                                }),
                          child: Text(l10n.needAccount),
                        ),
                      )
                    else
                      Center(
                        child: TextButton(
                          onPressed: _busy
                              ? null
                              : () => setState(() {
                                  _mode = _AuthMode.signIn;
                                  _error = null;
                                  _message = null;
                                }),
                          child: Text(
                            _mode == _AuthMode.newPassword
                                ? l10n.startSignInAgain
                                : l10n.backToSignIn,
                          ),
                        ),
                      ),
                    if (_message != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _message!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.tertiary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.error,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MissingConfigScreen extends StatelessWidget {
  const _MissingConfigScreen();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLowest,
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.backendConfigRequired,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.backendConfigMessage,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.surfaceVariantText,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const SelectableText(
                      'CRISIS_AWS_REGION\n'
                      'CRISIS_COGNITO_USER_POOL_ID\n'
                      'CRISIS_COGNITO_USER_POOL_CLIENT_ID\n'
                      'CRISIS_APPSYNC_GRAPHQL_URL',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(message),
          ],
        ),
      ),
    );
  }
}

class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  color: AppColors.error,
                  size: 56,
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: onRetry, child: Text(l10n.retry)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
