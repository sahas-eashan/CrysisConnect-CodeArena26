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

type PendingWarning = {
  disasterId: string;
  disasterTitle: string;
  targetArea: string;
  alertTitle: string;
  alertBody: string;
};

type DisasterFormState = {
  title: string;
  type: string;
  severity: string;
  description: string;
  secondaryRisks: string;
  warningMessage: string;
};

const defaultForm: DisasterFormState = {
  title: "",
  type: "",
  severity: "high",
  description: "",
  secondaryRisks: "",
  warningMessage: ""
};

const maxSmsLength = 621;

function buildWarningBody(title: string, description: string, customWarning: string) {
  const trimmedCustomWarning = customWarning.trim();
  if (trimmedCustomWarning) {
    return trimmedCustomWarning.slice(0, maxSmsLength);
  }

  const trimmedDescription = description.trim();
  const fallback = trimmedDescription
    ? `${title}. ${trimmedDescription} Follow official CrisisConnect guidance and move to the nearest safe zone if instructed.`
    : `${title}. Follow official CrisisConnect guidance and move to the nearest safe zone if instructed.`;

  return fallback.slice(0, maxSmsLength);
}

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
  const [sendingWarning, setSendingWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingWarning, setPendingWarning] = useState<PendingWarning | null>(null);

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

    if (!hasAwsConfig) {
      setError("Live backend is not configured, so disasters cannot be created from the government portal yet.");
      setMessage(null);
      return;
    }

    if (!geometry) {
      setError("Draw the affected polygon first so the warning can be geofenced to nearby citizens.");
      setMessage(null);
      return;
    }

    configureAmplify();
    const client = generateClient();

    const title = form.title.trim();
    const description = form.description.trim();
    const secondaryRisks = form.secondaryRisks
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.createDisaster,
        authMode: "userPool",
        variables: {
          input: {
            title,
            type: form.type.trim(),
            severity: form.severity,
            description: description || null,
            secondaryRisks: secondaryRisks.length ? secondaryRisks : null,
            affectedArea: geometry
          }
        }
      });

      const createdDisaster = (result as any).data?.createDisaster as Disaster | undefined;
      if (!createdDisaster?.id) {
        throw new Error("The backend did not return the created disaster record.");
      }

      setDisasters((current) => [createdDisaster, ...current.filter((item) => item.id !== createdDisaster.id)]);
      setPendingWarning({
        disasterId: createdDisaster.id,
        disasterTitle: title,
        targetArea: geometry,
        alertTitle: "CrisisConnect warning",
        alertBody: buildWarningBody(title, description, form.warningMessage)
      });
      setGeometry("");
      setForm(defaultForm);
      setMessage("Disaster registered. Review the drafted SMS below and send it when ready.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to register the disaster.");
      setPendingWarning(null);
    } finally {
      setSaving(false);
    }
  }

  async function onSendWarning() {
    if (!pendingWarning) return;

    if (!hasAwsConfig) {
      setError("Live backend is not configured, so SMS warnings cannot be sent.");
      setMessage(null);
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSendingWarning(true);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.sendAlert,
        authMode: "userPool",
        variables: {
          input: {
            title: pendingWarning.alertTitle,
            body: pendingWarning.alertBody,
            channel: ["sms"],
            targetArea: pendingWarning.targetArea,
            targetRoles: ["citizen"],
            disasterId: pendingWarning.disasterId
          }
        }
      });

      const alertResult = (result as any).data?.sendAlert as { channel?: string } | undefined;
      if (!alertResult?.channel) {
        throw new Error("The backend did not confirm the warning dispatch.");
      }

      setPendingWarning(null);
      setMessage(`SMS warning queued for citizens in the affected area via ${alertResult.channel}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the warning SMS.");
    } finally {
      setSendingWarning(false);
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
          <CardDescription className="mt-2">
            Create a live incident, then review the drafted government warning before sending a geofenced SMS to citizens.
          </CardDescription>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input
              name="title"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Incident title"
              required
              value={form.title}
            />
            <Input
              name="type"
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              placeholder="Type (flood, landslide, earthquake...)"
              required
              value={form.type}
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
              onChange={(event) => setForm((current) => ({ ...current, secondaryRisks: event.target.value }))}
              placeholder="Secondary risks (comma separated)"
              value={form.secondaryRisks}
            />
            <textarea
              className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              name="warningMessage"
              onChange={(event) => setForm((current) => ({ ...current, warningMessage: event.target.value }))}
              placeholder="Optional SMS warning copy. Leave blank to auto-draft from the disaster description."
              value={form.warningMessage}
            />
            <Input name="affectedArea" placeholder="Drawn polygon GeoJSON" readOnly value={geometry} />
            <Button className="w-full rounded-full" disabled={saving} type="submit" variant="danger">
              {saving ? "Publishing..." : "Register disaster"}
            </Button>
          </form>
          {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}

          {pendingWarning ? (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="font-medium text-white">Warning ready for {pendingWarning.disasterTitle}</p>
              <p className="mt-2 text-sm text-slate-200">{pendingWarning.alertBody}</p>
              <Button className="mt-4 w-full" disabled={sendingWarning} onClick={onSendWarning} variant="warning">
                {sendingWarning ? "Sending warning..." : "Send warning SMS"}
              </Button>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardTitle>Active incidents</CardTitle>
          <CardDescription className="mt-2">Latest disasters currently visible to the command role.</CardDescription>
          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-muted">
                Loading active disasters...
              </div>
            ) : null}
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
