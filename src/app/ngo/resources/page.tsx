"use client";

import { FormEvent, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { NgoResourceAiAssist } from "@/components/ai/ngo-ai-assist";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import type { Resource, ResourceRequest } from "@/lib/types";
import { cn, toTitleCase } from "@/lib/utils";

type ResourceFormState = {
  name: string;
  otherName: string;
  category: string;
  quantity: string;
  unit: string;
  location: string;
};

function sortRequests(requests: ResourceRequest[]) {
  const priorityWeight: Record<string, number> = {
    critical: 0,
    high: 1,
    urgent: 1,
    normal: 2,
    medium: 3,
    low: 4
  };

  return [...requests].sort((left, right) => {
    const leftPriority = priorityWeight[left.urgency?.toLowerCase() ?? "normal"] ?? 4;
    const rightPriority = priorityWeight[right.urgency?.toLowerCase() ?? "normal"] ?? 4;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

const defaultForm: ResourceFormState = {
  name: "",
  otherName: "",
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

export default function NgoResourcesPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [savingResource, setSavingResource] = useState(false);
  const [form, setForm] = useState<ResourceFormState>(defaultForm);
  const { coordinates, error: locationError, loading: locationLoading, requestLocation } = useGeolocation();

  const resourceOptions = Array.from(
    new Map(
      resources
        .filter((resource) => resource.name.trim())
        .map((resource) => [resource.name.trim().toLowerCase(), resource])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name));

  const selectedExistingResource =
    form.name && form.name !== "__other__"
      ? resourceOptions.find((resource) => resource.name === form.name) ?? null
      : null;
  const isOtherResource = form.name === "__other__";

  useEffect(() => {
    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [resourceResult, requestResult] = await Promise.all([
          client.graphql({ query: queries.getResources }),
          client.graphql({
            query: queries.getResourceRequests,
            authMode: "userPool",
            variables: { status: "pending" }
          })
        ]);

        if (!active) return;

        const nextResources = ((resourceResult as any).data?.getResources ?? []) as Resource[];
        const nextRequests = ((requestResult as any).data?.getResourceRequests ?? []) as ResourceRequest[];
        setResources(nextResources);
        setRequests(sortRequests(nextRequests));
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

    return () => {
      active = false;
      unsubscribeResourceUpdates.unsubscribe();
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

  const pendingRequest = requests.find((request) => (request.status ?? "pending").toLowerCase() !== "fulfilled") ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSavingResource(true);
      setError(null);
      setMessage(null);
      const quantity = Number(form.quantity);
      const location = normalizeLocationInput(form.location);
      const resourceName = isOtherResource ? form.otherName.trim() : form.name.trim();

      if (!resourceName) {
        throw new Error("Choose an existing resource or select Other and enter a resource name.");
      }

      await client.graphql({
        query: mutations.createResource,
        variables: {
          input: {
            name: resourceName,
            category: isOtherResource ? form.category.trim() || null : null,
            quantity: Number.isFinite(quantity) ? quantity : null,
            unit: isOtherResource ? form.unit.trim() || null : null,
            location
          }
        }
      });

      setMessage(selectedExistingResource ? "Existing resource inventory updated successfully." : "Resource published successfully.");
      setForm(defaultForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the resource update.");
    } finally {
      setSavingResource(false);
    }
  }

  return (
    <div className="space-y-6">
      <NgoResourceAiAssist
        requestId={pendingRequest?.id}
        requestSummary={
          pendingRequest
            ? {
                resourceName: pendingRequest.resourceName ?? "Unnamed request",
                quantityNeeded: pendingRequest.quantityNeeded ?? 0,
                urgency: pendingRequest.urgency ?? "normal"
              }
            : null
        }
      />

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
        </Card>

        <Card>
          <CardTitle>Add or update a resource</CardTitle>
          <CardDescription className="mt-2">
            Fast updates from the field keep routing and allocation accurate.
          </CardDescription>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="resource-name">
                Resource name
              </label>
              <select
                className="flex h-11 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-primary"
                id="resource-name"
                name="name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    otherName: event.target.value === "__other__" ? current.otherName : "",
                    category: event.target.value === "__other__" ? current.category : "",
                    unit: event.target.value === "__other__" ? current.unit : ""
                  }))
                }
              >
                <option disabled hidden value="">
                  Select a resource
                </option>
                {resourceOptions.map((resource) => (
                  <option key={resource.id} value={resource.name}>
                    {resource.name}
                  </option>
                ))}
                <option value="__other__">Other</option>
              </select>
            </div>
            {isOtherResource ? (
              <Input
                name="otherName"
                placeholder="Enter resource name"
                required
                value={form.otherName}
                onChange={(event) => setForm((current) => ({ ...current, otherName: event.target.value }))}
              />
            ) : null}
            {!selectedExistingResource ? (
              <Input
                name="category"
                placeholder="Category"
                required={isOtherResource}
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              />
            ) : null}
            <Input
              min={0}
              name="quantity"
              placeholder="Quantity"
              required
              type="number"
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
            />
            {!selectedExistingResource ? (
              <Input
                name="unit"
                placeholder="Unit"
                required={isOtherResource}
                value={form.unit}
                onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
              />
            ) : null}
            <Input
              name="location"
              placeholder='GeoJSON Point or POINT (77.8685 6.924)'
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
            {selectedExistingResource ? (
              <p className="text-sm text-muted">
                Updating existing inventory for {selectedExistingResource.name}
                {selectedExistingResource.category ? ` • ${selectedExistingResource.category}` : ""}
                {selectedExistingResource.unit ? ` • ${selectedExistingResource.unit}` : ""}.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button className="rounded-full" onClick={requestLocation} type="button" variant="outline">
                {locationLoading ? "Getting location..." : "Get current location"}
              </Button>
              {coordinates ? (
                <span className="rounded-full bg-success/15 px-3 py-2 text-sm text-green-300">
                  {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
                </span>
              ) : null}
            </div>
            {locationError ? <p className="text-sm text-danger">{locationError}</p> : null}
            <Button className="w-full rounded-full" disabled={savingResource} type="submit">
              {savingResource ? "Saving..." : "Save resource update"}
            </Button>
          </form>
          {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
        </Card>
      </div>
    </div>
  );
}
