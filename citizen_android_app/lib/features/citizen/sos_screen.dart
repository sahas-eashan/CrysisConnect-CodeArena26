import 'dart:async';

import 'package:crisisconnect_citizen/core/backend.dart';
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
        const SnackBar(
          content: Text('SOS sent. Responders have been notified.'),
        ),
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

  @override
  Widget build(BuildContext context) {
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
                FilledButton(onPressed: _refresh, child: const Text('Retry')),
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
                      ? 'Current location unavailable. Permission will be requested when you send SOS.'
                      : 'Current location captured and ready for emergency dispatch.',
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
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.emergency_share_rounded,
                          size: 72,
                          color: Colors.white,
                        ),
                        SizedBox(height: 10),
                        Text(
                          'HOLD TO\nSEND SOS',
                          textAlign: TextAlign.center,
                          style: TextStyle(
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
                'Press and hold for 3 seconds to send your location to the live CrisisConnect responder network.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.surfaceVariantText,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Emergency Type',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: _sosTypes
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
                decoration: const InputDecoration(
                  labelText: 'Describe the situation',
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
                'My SOS Status',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (latestSignal != null)
                _ResponderStatusCard(signal: latestSignal),
              if (signals.isEmpty)
                const _EmptyState(
                  message:
                      'Your SOS history will appear here after the first emergency request.',
                )
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
                  _statusHeadline(signal.status),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  responder?.fullName ??
                      'Awaiting nearest responder assignment',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (responder?.distance != null)
                  Text(
                    '${(responder!.distance! / 1000).toStringAsFixed(1)} km away',
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

  String _statusHeadline(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'assigned':
        return 'Help is on the way';
      case 'resolved':
        return 'Emergency closed';
      default:
        return 'Awaiting dispatch';
    }
  }
}

class _AiPreparedSosCard extends StatelessWidget {
  const _AiPreparedSosCard({required this.result});

  final PreparedSos result;

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
          Text(result.refined),
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
                  signal.description ?? 'No description provided.',
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

const _sosTypes = [
  _SosType('medical', 'Medical'),
  _SosType('trapped', 'Trapped'),
  _SosType('evacuation', 'Evacuation'),
  _SosType('resources', 'Resources'),
];
