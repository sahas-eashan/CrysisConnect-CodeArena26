"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import type { Resource } from "@/lib/types";
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
    JSON.parse(trimmed);
    return trimmed;
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

function statusTone(status?: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "available":
      return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20";
    case "low":
      return "bg-amber-500/15 text-amber-100 border border-amber-400/20";
    case "depleted":
      return "bg-red-500/15 text-red-200 border border-red-400/20";
    default:
      return "bg-slate-900 text-slate-300 border border-white/10";
  }
}

export default function AdminResourcesPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ResourceFormState>(defaultForm);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadResources() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);
        const result = await client.graphql({
          query: queries.getResources,
          authMode: "userPool"
        });

        if (!active) return;

        setResources(((result as any).data?.getResources ?? []) as Resource[]);
      } catch (loadError) {
        if (!active) return;
        setResources([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load command inventory.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadResources();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  const summary = useMemo(() => {
    const totalUnits = resources.reduce((sum, resource) => sum + Math.max(0, Number(resource.quantity ?? 0)), 0);
    const lowStock = resources.filter((resource) => (resource.status ?? "").toLowerCase() === "low").length;
    const depleted = resources.filter((resource) => (resource.status ?? "").toLowerCase() === "depleted").length;
    return { totalUnits, lowStock, depleted };
  }, [resources]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const quantity = Number(form.quantity);
      const location = normalizeLocationInput(form.location);

      const result = await client.graphql({
        query: mutations.createResource,
        authMode: "userPool",
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

      const createdResource = (result as any).data?.createResource as Resource | undefined;
      if (!createdResource?.id) {
        throw new Error("The backend did not return the saved resource.");
      }

      setResources((current) => [createdResource, ...current]);
      setForm(defaultForm);
      setMessage("Resource added to the live command inventory.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the resource.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Tracked stock units</CardTitle>
          <CardDescription className="mt-2">Combined live inventory across the shared resource pool.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{summary.totalUnits}</p>
        </Card>
        <Card className="border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Low stock alerts</CardTitle>
          <CardDescription className="mt-2">Items that need reallocation or replenishment.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{summary.lowStock}</p>
        </Card>
        <Card className="border-red-400/20 bg-gradient-to-br from-red-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Depleted lines</CardTitle>
          <CardDescription className="mt-2">Items with no usable availability remaining.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{summary.depleted}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardTitle>Cross-agency resource overview</CardTitle>
          <CardDescription className="mt-2">
            Monitor live stock levels and identify the lines that need immediate redistribution.
          </CardDescription>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {resources.map((resource) => (
              <div
                className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%),linear-gradient(180deg,rgba(13,21,37,0.98),rgba(7,12,24,0.95))] p-5"
                key={resource.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-white">{resource.name}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {resource.quantity ?? 0} {resource.unit ?? "units"} • {resource.category ?? "uncategorized"}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", statusTone(resource.status))}>
                    {resource.status ? toTitleCase(resource.status) : "Unknown"}
                  </span>
                </div>
                {resource.location ? (
                  <p className="mt-4 text-xs text-muted">Location recorded for map routing.</p>
                ) : (
                  <p className="mt-4 text-xs text-muted">No live location attached.</p>
                )}
              </div>
            ))}
            {!resources.length && !loading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-muted">
                No live command inventory is available yet.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle>Add command inventory</CardTitle>
          <CardDescription className="mt-2">Publish new stock directly into the shared backend resource pool.</CardDescription>
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
              value={form.unit}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
            />
            <Input
              name="location"
              placeholder='GeoJSON Point or POINT (77.8685 6.924)'
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
            <Button className="w-full rounded-full" disabled={saving} type="submit" variant="success">
              {saving ? "Saving..." : "Add to command inventory"}
            </Button>
          </form>
          {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
        </Card>
      </div>
    </div>
  );
}
