import 'dart:async';

import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:flutter/material.dart';

class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({
    super.key,
    required this.repository,
    required this.userId,
  });

  final CitizenRepository repository;
  final String userId;

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  late Future<ResourcesBundle> _future;
  StreamSubscription<ResourceItem>? _resourceSubscription;
  StreamSubscription<ResourceRequestItem>? _requestSubscription;

  final TextEditingController _searchController = TextEditingController();
  String _category = 'All';
  final List<ResourceItem> _liveResources = [];
  final List<ResourceRequestItem> _liveRequests = [];

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadResourcesBundle();
    _resourceSubscription = widget.repository
        .subscribeToResourceUpdates()
        .listen((item) {
          if (!mounted) return;
          setState(() {
            _liveResources.removeWhere((resource) => resource.id == item.id);
            _liveResources.insert(0, item);
          });
        });
    _requestSubscription = widget.repository
        .subscribeToMyRequestUpdates(widget.userId)
        .listen((item) {
          if (!mounted) return;
          setState(() {
            _liveRequests.removeWhere((request) => request.id == item.id);
            _liveRequests.insert(0, item);
          });
        });
  }

  @override
  void dispose() {
    _resourceSubscription?.cancel();
    _requestSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = widget.repository.loadResourcesBundle();
    });
    await _future;
  }

  Future<void> _requestResource(ResourceItem resource) async {
    final quantityController = TextEditingController(text: '1');
    String urgency = 'normal';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              title: Text('Request ${resource.name}'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: quantityController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Quantity needed',
                    ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: urgency,
                    items: const [
                      DropdownMenuItem(value: 'normal', child: Text('Normal')),
                      DropdownMenuItem(value: 'high', child: Text('High')),
                      DropdownMenuItem(
                        value: 'critical',
                        child: Text('Critical'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setModalState(() => urgency = value);
                    },
                    decoration: const InputDecoration(labelText: 'Urgency'),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Submit'),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed != true) {
      quantityController.dispose();
      return;
    }

    try {
      final request = await widget.repository.requestResource(
        resourceId: resource.id,
        resourceName: resource.name,
        quantityNeeded: int.tryParse(quantityController.text) ?? 1,
        urgency: urgency,
      );
      if (!mounted) return;
      setState(() {
        _liveRequests.removeWhere((item) => item.id == request.id);
        _liveRequests.insert(0, request);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Resource request submitted successfully.'),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      quantityController.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<ResourcesBundle>(
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
          final allResources = _mergeResources(bundle.resources);
          final requests = _mergeRequests(bundle.requests);
          final filteredResources = allResources.where((resource) {
            final matchesCategory =
                _category == 'All' || resource.category == _category;
            final matchesSearch =
                _searchController.text.trim().isEmpty ||
                resource.name.toLowerCase().contains(
                  _searchController.text.trim().toLowerCase(),
                );
            return matchesCategory && matchesSearch;
          }).toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 140),
            children: [
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'Search supplies',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['All', 'Food', 'Water', 'Medical', 'Shelter']
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(item),
                            selected: _category == item,
                            onSelected: (_) => setState(() => _category = item),
                            backgroundColor: AppColors.surfaceHighest,
                            selectedColor: AppColors.primary,
                            side: BorderSide.none,
                            showCheckmark: false,
                            labelStyle: TextStyle(
                              color: _category == item
                                  ? Colors.white
                                  : AppColors.onSurface,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Live Resource Catalog',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (filteredResources.isEmpty)
                const _EmptyState(
                  message: 'No resources match your current filter.',
                )
              else
                ...filteredResources.map(
                  (resource) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ResourceCard(
                      resource: resource,
                      onRequest: () => _requestResource(resource),
                    ),
                  ),
                ),
              const SizedBox(height: 20),
              Text(
                'My Active Requests',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (requests.isEmpty)
                const _EmptyState(
                  message:
                      'Your request history will appear here once you submit a resource request.',
                )
              else
                ...requests.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _RequestTile(request: item),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  List<ResourceItem> _mergeResources(List<ResourceItem> initial) {
    final merged = [...initial];
    for (final resource in _liveResources) {
      merged.removeWhere((item) => item.id == resource.id);
      merged.insert(0, resource);
    }
    return merged;
  }

  List<ResourceRequestItem> _mergeRequests(List<ResourceRequestItem> initial) {
    final merged = [...initial];
    for (final request in _liveRequests) {
      merged.removeWhere((item) => item.id == request.id);
      merged.insert(0, request);
    }
    return merged;
  }
}

class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.resource, required this.onRequest});

  final ResourceItem resource;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      resource.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        if (resource.category != null) resource.category!,
                        if (resource.quantity != null)
                          '${resource.quantity} ${resource.unit ?? 'units'}',
                      ].join(' • '),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.surfaceVariantText,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: _statusColor(
                          resource.status,
                        ).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        (resource.status ?? 'unknown').toUpperCase(),
                        style: TextStyle(
                          color: _statusColor(resource.status),
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              FilledButton(onPressed: onRequest, child: const Text('Request')),
            ],
          ),
          if (resource.managedBy != null) ...[
            const SizedBox(height: 12),
            Text(
              'Managed by ${resource.managedBy}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.outline),
            ),
          ],
        ],
      ),
    );
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'available':
        return AppColors.tertiary;
      case 'low':
        return AppColors.secondary;
      case 'depleted':
        return AppColors.outline;
      default:
        return AppColors.primary;
    }
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request});

  final ResourceRequestItem request;

  @override
  Widget build(BuildContext context) {
    final fulfilled = (request.status ?? '').toLowerCase() == 'fulfilled';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: (fulfilled ? AppColors.tertiary : AppColors.primary)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              fulfilled ? Icons.check_circle_rounded : Icons.schedule_rounded,
              color: fulfilled ? AppColors.tertiary : AppColors.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.resourceName ?? 'Custom request',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  '${request.quantityNeeded ?? 1} units • ${request.urgency ?? 'normal'} priority',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.surfaceVariantText,
                  ),
                ),
              ],
            ),
          ),
          Text(
            (request.status ?? 'pending').toUpperCase(),
            style: TextStyle(
              color: fulfilled ? AppColors.tertiary : AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
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
