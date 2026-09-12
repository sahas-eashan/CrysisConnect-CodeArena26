"use client";

import { FormEvent, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { MapDraw } from "@/components/map/map-draw";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import type { Disaster } from "@/lib/types";
import { cn, toTitleCase } from "@/lib/utils";

type DisasterFormState = {
  title: string;
  type: string;
  severity: string;
  description: string;
  secondaryRisks: string;
};

const defaultForm: DisasterFormState = {
  title: "",
  type: "",
  severity: "high",
  description: "",
  secondaryRisks: ""
};

function severityTone(severity?: string | null) {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
      return "border border-red-400/30 bg-red-500/15 text-red-200";
    case "high":
      return "border border-amber-400/30 bg-amber-500/15 text-amber-100";
    case "medium":
      return "border border-sky-400/30 bg-sky-500/15 text-sky-100";
    default:
      return "border border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }
}

export default function AdminDisastersPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [geometry, setGeometry] = useState("");
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [form, setForm] = useState<DisasterFormState>(defaultForm);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadDisasters() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);
        const result = await client.graphql({
          query: queries.getDisasters,
          authMode: "userPool",
          variables: { status: "active" }
        });

        if (!active) return;

        setDisasters(((result as any).data?.getDisasters ?? []) as Disaster[]);
      } catch (loadError) {
        if (!active) return;
        setDisasters([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load active disasters.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDisasters();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAwsConfig) return;
    if (!geometry) {
      setError("Draw the affected area on the map before registering the incident.");
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.createDisaster,
        authMode: "userPool",
        variables: {
          input: {
            title: form.title.trim(),
            type: form.type.trim(),
            severity: form.severity,
            description: form.description.trim() || null,
            secondaryRisks: form.secondaryRisks
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            affectedArea: geometry
          }
        }
      });

      const createdDisaster = (result as any).data?.createDisaster as Disaster | undefined;
      if (!createdDisaster?.id) {
        throw new Error("The backend did not return the created disaster record.");
      }

      setDisasters((current) => [createdDisaster, ...current]);
      setGeometry("");
      setForm(defaultForm);
      setMessage("Disaster registered and published to the live command network.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to register the disaster.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="border-red-400/20 bg-gradient-to-br from-red-500/10 via-slate-950/90 to-transparent">
        <CardTitle>Command incident map</CardTitle>
        <CardDescription className="mt-2">Draw the active impact zone and publish it directly into live operations.</CardDescription>
        <div className="mt-6">
          <MapDraw onGeometryChange={setGeometry} />
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardTitle>Register disaster</CardTitle>
          <CardDescription className="mt-2">Create a live incident and make it visible across command, citizen, and NGO views.</CardDescription>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input
              name="title"
              placeholder="Incident title"
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
            <Input
              name="type"
              placeholder="Type (flood, landslide, earthquake...)"
              required
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            />
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              name="severity"
              onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
              value={form.severity}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <textarea
              className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              name="description"
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Operational summary"
              value={form.description}
            />
            <Input
              name="secondaryRisks"
              placeholder="Secondary risks (comma separated)"
              value={form.secondaryRisks}
              onChange={(event) => setForm((current) => ({ ...current, secondaryRisks: event.target.value }))}
            />
            <Input name="affectedArea" placeholder="Drawn polygon GeoJSON" readOnly value={geometry} />
            <Button className="w-full rounded-full" disabled={saving} type="submit" variant="danger">
              {saving ? "Publishing..." : "Register disaster"}
            </Button>
          </form>
          {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
        </Card>

        <Card>
          <CardTitle>Active incidents</CardTitle>
          <CardDescription className="mt-2">Latest disasters currently visible to the command role.</CardDescription>
          <div className="mt-6 space-y-3">
            {disasters.map((disaster) => (
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4" key={disaster.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-white">{disaster.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{disaster.description ?? "No incident summary provided."}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", severityTone(disaster.severity))}>
                    {toTitleCase(disaster.severity)}
                  </span>
                </div>
              </div>
            ))}
            {!disasters.length && !loading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-muted">
                No active disasters are currently published.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
