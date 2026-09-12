import 'dart:async';

import 'package:crisisconnect_citizen/core/backend.dart';
import 'package:crisisconnect_citizen/l10n/app_localizations.dart';
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
    await _showRequestDialog(
      resourceName: resource.name,
      resourceId: resource.id,
      title: AppLocalizations.of(context)!.requestDialogTitle(resource.name),
    );
  }

  Future<void> _requestCustomResource() async {
    final l10n = AppLocalizations.of(context)!;
    final nameController = TextEditingController(
      text: _searchController.text.trim(),
    );
    final quantityController = TextEditingController(text: '1');
    String urgency = 'normal';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              title: Text(l10n.requestUnlistedItem),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameController,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(labelText: l10n.itemName),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: quantityController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: l10n.quantityNeeded),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: urgency,
                    items: [
                      DropdownMenuItem(
                        value: 'normal',
                        child: Text(l10n.urgencyNormal),
                      ),
                      DropdownMenuItem(
                        value: 'high',
                        child: Text(l10n.urgencyHigh),
                      ),
                      DropdownMenuItem(
                        value: 'critical',
                        child: Text(l10n.urgencyCritical),
                      ),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setModalState(() => urgency = value);
                    },
                    decoration: InputDecoration(labelText: l10n.urgency),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(l10n.cancelButton),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: Text(l10n.submitButton),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed != true) {
      nameController.dispose();
      quantityController.dispose();
      return;
    }

    final resourceName = nameController.text.trim();
    if (resourceName.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.itemNameRequired)));
      }
      nameController.dispose();
      quantityController.dispose();
      return;
    }

    await _submitResourceRequest(
      resourceId: null,
      resourceName: resourceName,
      quantityNeeded: int.tryParse(quantityController.text) ?? 1,
      urgency: urgency,
    );

    nameController.dispose();
    quantityController.dispose();
  }

  Future<void> _showRequestDialog({
    required String resourceName,
    required String? resourceId,
    required String title,
  }) async {
    final l10n = AppLocalizations.of(context)!;
    final quantityController = TextEditingController(text: '1');
    String urgency = 'normal';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              title: Text(title),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: quantityController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: l10n.quantityNeeded),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: urgency,
                    items: [
                      DropdownMenuItem(
                        value: 'normal',
                        child: Text(l10n.urgencyNormal),
                      ),
                      DropdownMenuItem(
                        value: 'high',
                        child: Text(l10n.urgencyHigh),
                      ),
                      DropdownMenuItem(
                        value: 'critical',
                        child: Text(l10n.urgencyCritical),
                      ),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setModalState(() => urgency = value);
                    },
                    decoration: InputDecoration(labelText: l10n.urgency),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(l10n.cancelButton),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: Text(l10n.submitButton),
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

    await _submitResourceRequest(
      resourceId: resourceId,
      resourceName: resourceName,
      quantityNeeded: int.tryParse(quantityController.text) ?? 1,
      urgency: urgency,
    );

    quantityController.dispose();
  }

  Future<void> _submitResourceRequest({
    required String? resourceId,
    required String resourceName,
    required int quantityNeeded,
    required String urgency,
  }) async {
    final l10n = AppLocalizations.of(context)!;

    try {
      final request = await widget.repository.requestResource(
        resourceId: resourceId,
        resourceName: resourceName,
        quantityNeeded: quantityNeeded,
        urgency: urgency,
      );
      if (!mounted) return;
      setState(() {
        _liveRequests.removeWhere((item) => item.id == request.id);
        _liveRequests.insert(0, request);
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.resourceRequestSuccess)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

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
                FilledButton(onPressed: _refresh, child: Text(l10n.retry)),
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

          final categories = [
            ('All', l10n.categoryAll),
            ('Food', l10n.categoryFood),
            ('Water', l10n.categoryWater),
            ('Medical', l10n.categoryMedical),
            ('Shelter', l10n.categoryShelter),
          ];

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 140),
            children: [
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: l10n.searchSupplies,
                  prefixIcon: const Icon(Icons.search_rounded),
                ),
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: categories
                      .map(
                        (entry) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(entry.$2),
                            selected: _category == entry.$1,
                            onSelected: (_) =>
                                setState(() => _category = entry.$1),
                            backgroundColor: AppColors.surfaceHighest,
                            selectedColor: AppColors.primary,
                            side: BorderSide.none,
                            showCheckmark: false,
                            labelStyle: TextStyle(
                              color: _category == entry.$1
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
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.requestUnlistedItem,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.requestUnlistedDescription,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.surfaceVariantText),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton.icon(
                      onPressed: _requestCustomResource,
                      icon: const Icon(Icons.add_circle_outline_rounded),
                      label: Text(l10n.requestButton),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                l10n.liveResourceCatalog,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (filteredResources.isEmpty)
                _EmptyState(message: l10n.noResourcesMatch)
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
                l10n.myActiveRequests,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (requests.isEmpty)
                _EmptyState(message: l10n.requestHistoryEmpty)
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
    final l10n = AppLocalizations.of(context)!;
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
                          '${resource.quantity} ${resource.unit ?? l10n.units}',
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
              FilledButton(
                onPressed: onRequest,
                child: Text(l10n.requestButton),
              ),
            ],
          ),
          if (resource.managedBy != null) ...[
            const SizedBox(height: 12),
            Text(
              l10n.managedBy(resource.managedBy!),
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
    final l10n = AppLocalizations.of(context)!;
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
                  request.resourceName ?? l10n.customRequest,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  '${request.quantityNeeded ?? 1} ${l10n.units} • ${request.urgency ?? 'normal'} ${l10n.priority}',
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
