"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import { mockResourceRequests, mockResources } from "@/lib/mock-data";
import type { Resource, ResourceRequest } from "@/lib/types";
import { cn, toTitleCase } from "@/lib/utils";

type ResourceFormState = {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
};

const defaultForm: ResourceFormState = {
  name: "",
  category: "",
  quantity: "",
  unit: "",
  location: ""
};

function normalizeLocationInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { type?: string; coordinates?: unknown };
    if (
      parsed.type === "Point" &&
      Array.isArray(parsed.coordinates) &&
      parsed.coordinates.length >= 2 &&
      Number.isFinite(Number(parsed.coordinates[0])) &&
      Number.isFinite(Number(parsed.coordinates[1]))
    ) {
      return JSON.stringify({
        type: "Point",
        coordinates: [Number(parsed.coordinates[0]), Number(parsed.coordinates[1])]
      });
    }
    throw new Error("Location JSON must be a GeoJSON Point with numeric coordinates.");
  }

  const match = trimmed.match(/^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
  if (match) {
    return JSON.stringify({
      type: "Point",
      coordinates: [Number(match[1]), Number(match[2])]
    });
  }

  throw new Error("Location must be GeoJSON Point JSON or WKT like POINT (77.8685 6.924).");
}

function sortRequests(requests: ResourceRequest[]) {
  const priorityWeight: Record<string, number> = {
    high: 0,
    urgent: 0,
    medium: 1,
    normal: 2,
    low: 3
  };

  return [...requests].sort((left, right) => {
    const leftPriority = priorityWeight[left.urgency?.toLowerCase() ?? "normal"] ?? 4;
    const rightPriority = priorityWeight[right.urgency?.toLowerCase() ?? "normal"] ?? 4;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

export default function NgoResourcesPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [resources, setResources] = useState<Resource[]>(() => (hasAwsConfig ? [] : mockResources));
  const [requests, setRequests] = useState<ResourceRequest[]>(() => (hasAwsConfig ? [] : mockResourceRequests));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [savingResource, setSavingResource] = useState(false);
  const [form, setForm] = useState<ResourceFormState>(defaultForm);
  const { coordinates, error: locationError, loading: locationLoading, requestLocation } = useGeolocation();

  useEffect(() => {
    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [resourceResult, requestResult] = await Promise.allSettled([
          client.graphql({ query: queries.getResources }),
          client.graphql({ query: queries.getResourceRequests, variables: { status: "pending" } })
        ]);

        if (!active) return;

        if (resourceResult.status === "fulfilled") {
          const nextResources = ((resourceResult.value as any).data?.getResources ?? []) as Resource[];
          setResources(nextResources);
        } else {
          setResources([]);
        }

        if (requestResult.status === "fulfilled") {
          const nextRequests = ((requestResult.value as any).data?.getResourceRequests ?? []) as ResourceRequest[];
          setRequests(sortRequests(nextRequests));
        } else {
          setRequests([]);
          const message =
            requestResult.reason instanceof Error ? requestResult.reason.message : "Unable to load NGO resource data.";
          setError(
            message.includes("Unauthorized")
              ? "This Cognito account is not in the NGO or government group, so live citizen requests cannot be loaded here."
              : message
          );
        }
      } catch (loadError) {
        if (!active) return;
        setResources([]);
        setRequests([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load NGO resource data.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    const unsubscribeResourceUpdates = (client.graphql({
      query: subscriptions.onResourceUpdate
    }) as any).subscribe({
      next: () => {
        void load();
      },
      error: (subscriptionError: unknown) => console.error("Resource subscription error", subscriptionError)
    });

    const unsubscribeRequestUpdates = (client.graphql({
      query: subscriptions.onNewResourceRequest
    }) as any).subscribe({
      next: () => {
        void load();
      },
      error: (subscriptionError: unknown) => console.error("Request subscription error", subscriptionError)
    });

    return () => {
      active = false;
      unsubscribeResourceUpdates.unsubscribe();
      unsubscribeRequestUpdates.unsubscribe();
    };
  }, [hasAwsConfig]);

  useEffect(() => {
    if (!coordinates) return;

    setForm((current) => ({
      ...current,
      location: JSON.stringify({
        type: "Point",
        coordinates: [coordinates.longitude, coordinates.latitude]
      })
    }));
  }, [coordinates]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => (request.status ?? "pending").toLowerCase() !== "fulfilled"),
    [requests]
  );

  async function onFulfill(id: string) {
    if (!hasAwsConfig) {
      setRequests((current) =>
        current.map((request) => (request.id === id ? { ...request, status: "fulfilled" } : request))
      );
      setMessage("Demo mode: request marked as fulfilled.");
      setError(null);
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setFulfillingId(id);
      setError(null);
      const result = await client.graphql({
        query: mutations.fulfillResourceRequest,
        variables: { id }
      });

      const updatedRequest = (result as any).data?.fulfillResourceRequest as ResourceRequest | undefined;
      if (updatedRequest) {
        setRequests((current) => sortRequests(current.map((request) => (request.id === id ? updatedRequest : request))));
      }
      setMessage("Request marked as fulfilled.");
    } catch (fulfillError) {
      setError(fulfillError instanceof Error ? fulfillError.message : "Unable to fulfill the request.");
    } finally {
      setFulfillingId(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAwsConfig) {
      setMessage("Demo mode: resource mutation prepared. Connect AWS to publish live inventory updates.");
      setError(null);
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSavingResource(true);
      setError(null);
      const quantity = Number(form.quantity);
      const location = normalizeLocationInput(form.location);
      await client.graphql({
        query: mutations.createResource,
        variables: {
          input: {
            name: form.name.trim(),
            category: form.category.trim() || null,
            quantity: Number.isFinite(quantity) ? quantity : null,
            unit: form.unit.trim() || null,
            location
          }
        }
      });

      setMessage("Resource published successfully.");
      setForm(defaultForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the resource update.");
    } finally {
      setSavingResource(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <CardTitle>Manage field inventory</CardTitle>
        <CardDescription className="mt-2">
          Publish stock levels so citizens and government teams share the same operating picture.
        </CardDescription>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {resources.map((resource) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={resource.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{resource.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {resource.quantity ?? 0} {resource.unit ?? "units"} • {resource.category ?? "uncategorized"}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    resource.status === "available" && "bg-emerald-500/15 text-emerald-300",
                    resource.status === "low" && "bg-amber-500/15 text-amber-200",
                    resource.status === "depleted" && "bg-red-500/15 text-red-200",
                    !resource.status && "bg-slate-900 text-slate-300"
                  )}
                >
                  {resource.status ? toTitleCase(resource.status) : "Unknown"}
                </span>
              </div>
            </div>
          ))}
          {!resources.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No live resource inventory is available yet.
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <p className="text-sm font-medium text-white">Incoming citizen requests</p>
          <div className="mt-3 space-y-3">
            {pendingRequests.map((request) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={request.id}>
                <p className="font-medium text-white">{request.resourceName ?? "Unnamed request"}</p>
                <p className="mt-1 text-sm text-muted">
                  Needs {request.quantityNeeded ?? 0} • {(request.urgency ?? "normal").toLowerCase()} priority
                </p>
                <div className="mt-3">
                  <Button disabled={fulfillingId === request.id} onClick={() => void onFulfill(request.id)}>
                    {fulfillingId === request.id ? "Saving..." : "Mark as fulfilled"}
                  </Button>
                </div>
              </div>
            ))}
            {!pendingRequests.length && !loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
                No pending citizen requests right now.
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Add or update a resource</CardTitle>
        <CardDescription className="mt-2">
          Fast updates from the field keep routing and allocation accurate.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input
            name="name"
            placeholder="Resource name"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            name="category"
            placeholder="Category"
            required
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          />
          <Input
            min={0}
            name="quantity"
            placeholder="Quantity"
            required
            type="number"
            value={form.quantity}
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
          />
          <Input
            name="unit"
            placeholder="Unit"
            required
            value={form.unit}
            onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
          />
          <Input
            name="location"
            placeholder='GeoJSON Point or POINT (77.8685 6.924)'
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={requestLocation} type="button" variant="outline">
              {locationLoading ? "Getting location..." : "Get current location"}
            </Button>
            {coordinates ? (
              <span className="rounded-full bg-success/15 px-3 py-2 text-sm text-green-300">
                {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
              </span>
            ) : null}
          </div>
          {locationError ? <p className="text-sm text-danger">{locationError}</p> : null}
          <Button className="w-full" disabled={savingResource} type="submit">
            {savingResource ? "Saving..." : "Save resource update"}
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>
    </div>
  );
}
