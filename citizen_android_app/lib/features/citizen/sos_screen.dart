import 'dart:async';

import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class SosScreen extends StatefulWidget {
  const SosScreen({super.key, required this.repository, required this.userId});

  final CitizenRepository repository;
  final String userId;

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> {
  late Future<SosBundle> _future;
  StreamSubscription<SosSignal>? _subscription;
  final List<SosSignal> _liveSignals = [];
  String _selectedType = 'medical';
  final TextEditingController _descriptionController = TextEditingController();
  PreparedSos? _preparedSos;
  bool _preparing = false;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadSosBundle();
    _subscription = widget.repository
        .subscribeToMySosUpdates(widget.userId)
        .listen((signal) {
          if (!mounted) return;
          setState(() {
            _liveSignals.removeWhere((item) => item.id == signal.id);
            _liveSignals.insert(0, signal);
          });
        });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.repository.loadSosBundle();
    });
    await _future;
  }

  Future<void> _sendSos() async {
    final l10n = AppLocalizations.of(context)!;
    try {
      final signal = await widget.repository.createSos(
        type: _selectedType,
        description: _descriptionController.text.trim().isEmpty
            ? null
            : _descriptionController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _liveSignals.removeWhere((item) => item.id == signal.id);
        _liveSignals.insert(0, signal);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.sosSent)),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  Future<void> _prepareWithAi() async {
    if (_descriptionController.text.trim().isEmpty) return;

    try {
      setState(() => _preparing = true);
      final prepared = await widget.repository.prepareSosSubmission(
        type: _selectedType,
        description: _descriptionController.text.trim(),
      );
      if (!mounted) return;
      setState(() => _preparedSos = prepared);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _preparing = false);
      }
    }
  }

  List<_SosType> _localizedSosTypes(AppLocalizations l10n) => [
    _SosType('medical', l10n.medical),
    _SosType('trapped', l10n.trapped),
    _SosType('evacuation', l10n.evacuation),
    _SosType('resources', l10n.resourcesType),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final sosTypes = _localizedSosTypes(l10n);

    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<SosBundle>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const SizedBox(height: 120),
                Text(snapshot.error.toString(), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: _refresh, child: Text(l10n.retry)),
              ],
            );
          }

          final bundle = snapshot.data!;
          final signals = [...bundle.signals];
          for (final signal in _liveSignals) {
            signals.removeWhere((item) => item.id == signal.id);
            signals.insert(0, signal);
          }
          final latestSignal = signals.isEmpty ? null : signals.first;

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 140),
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  bundle.currentLocation == null
                      ? l10n.locationUnavailable
                      : l10n.locationReady,
                  textAlign: TextAlign.center,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: GestureDetector(
                  onLongPress: _sendSos,
                  child: Container(
                    width: 240,
                    height: 240,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.secondary,
                          AppColors.secondaryContainer,
                        ],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.secondary.withValues(alpha: 0.24),
                          blurRadius: 38,
                          offset: const Offset(0, 18),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.emergency_share_rounded,
                          size: 72,
                          color: Colors.white,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          l10n.holdToSendSos,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 28,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                l10n.sosInstruction,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.surfaceVariantText,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                l10n.emergencyType,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: sosTypes
                    .map(
                      (type) => ChoiceChip(
                        label: Text(type.label),
                        selected: _selectedType == type.value,
                        onSelected: (_) =>
                            setState(() => _selectedType = type.value),
                        selectedColor: AppColors.primary,
                        backgroundColor: AppColors.surfaceHighest,
                        side: BorderSide.none,
                        showCheckmark: false,
                        labelStyle: TextStyle(
                          color: _selectedType == type.value
                              ? Colors.white
                              : AppColors.onSurface,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _descriptionController,
                onChanged: (_) => setState(() => _preparedSos = null),
                minLines: 3,
                maxLines: 5,
                decoration: InputDecoration(
                  labelText: l10n.describeSituation,
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _preparing ? null : _prepareWithAi,
                child: Text(
                  _preparing ? 'Preparing with AI...' : 'Prepare with AI',
                ),
              ),
              if (_preparedSos != null) ...[
                const SizedBox(height: 12),
                _AiPreparedSosCard(result: _preparedSos!),
              ],
              const SizedBox(height: 20),
              Text(
                l10n.mySosStatus,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (latestSignal != null)
                _ResponderStatusCard(signal: latestSignal),
              if (signals.isEmpty)
                _EmptyState(message: l10n.sosHistoryEmpty)
              else
                ...signals.map(
                  (signal) => Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: _SosTile(signal: signal),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ResponderStatusCard extends StatelessWidget {
  const _ResponderStatusCard({required this.signal});

  final SosSignal signal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final responder = signal.nearestResponders.isEmpty
        ? null
        : signal.nearestResponders.first;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceHighest,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.primaryFixed,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.person_rounded, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _statusHeadline(signal.status, l10n),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  responder?.fullName ?? l10n.awaitingResponder,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (responder?.distance != null)
                  Text(
                    l10n.kmAway((responder!.distance! / 1000).toStringAsFixed(1)),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: AppColors.outline),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _statusHeadline(String? status, AppLocalizations l10n) {
    switch ((status ?? '').toLowerCase()) {
      case 'assigned':
        return l10n.helpOnTheWay;
      case 'resolved':
        return l10n.emergencyClosed;
      default:
        return l10n.awaitingDispatch;
    }
  }
}

class _AiPreparedSosCard extends StatelessWidget {
  const _AiPreparedSosCard({required this.result});

  final PreparedSos result;

  String _localizedSummary(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    switch (languageCode) {
      case 'si':
        return result.translations.sinhala.isNotEmpty
            ? result.translations.sinhala
            : result.refined;
      case 'ta':
        return result.translations.tamil.isNotEmpty
            ? result.translations.tamil
            : result.refined;
      default:
        return result.translations.english.isNotEmpty
            ? result.translations.english
            : result.refined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceHighest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'AI Prepared SOS Summary',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(_localizedSummary(context)),
          const SizedBox(height: 10),
          ...result.checklist.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('• $item'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SosTile extends StatelessWidget {
  const _SosTile({required this.signal});

  final SosSignal signal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: _statusColor(signal.status).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.emergency_rounded,
              color: _statusColor(signal.status),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (signal.type ?? 'SOS').toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  signal.description ?? l10n.noDescription,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.surfaceVariantText,
                  ),
                ),
              ],
            ),
          ),
          Text(
            (signal.status ?? 'pending').toUpperCase(),
            style: TextStyle(
              color: _statusColor(signal.status),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'assigned':
        return AppColors.primary;
      case 'resolved':
        return AppColors.tertiary;
      default:
        return AppColors.secondary;
    }
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Text(message),
    );
  }
}

class _SosType {
  const _SosType(this.value, this.label);

  final String value;
  final String label;
}
