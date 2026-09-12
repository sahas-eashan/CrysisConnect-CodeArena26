"use client";

import { FormEvent, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { MapDraw } from "@/components/map/map-draw";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations } from "@/lib/aws/graphql/operations";
import { mockDisasters } from "@/lib/mock-data";

type PendingWarning = {
  disasterId: string;
  disasterTitle: string;
  targetArea: string;
  alertTitle: string;
  alertBody: string;
};

const maxSmsLength = 621;

function buildWarningBody(title: string, description: string, customWarning: string) {
  const trimmedCustomWarning = customWarning.trim();
  if (trimmedCustomWarning) {
    return trimmedCustomWarning.slice(0, maxSmsLength);
  }

  const fallback = description.trim()
    ? `${title}. ${description.trim()} Follow official CrisisConnect guidance and move to the nearest safe zone if instructed.`
    : `${title}. Follow official CrisisConnect guidance and move to the nearest safe zone if instructed.`;

  return fallback.slice(0, maxSmsLength);
}

export default function AdminDisastersPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [geometry, setGeometry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingWarning, setSendingWarning] = useState(false);
  const [latestIncidentTitle, setLatestIncidentTitle] = useState(mockDisasters[0].title);
  const [pendingWarning, setPendingWarning] = useState<PendingWarning | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    const type = String(form.get("type") ?? "").trim();
    const severity = String(form.get("severity") ?? "medium").trim();
    const description = String(form.get("description") ?? "").trim();
    const warningMessage = String(form.get("warningMessage") ?? "").trim();
    const secondaryRisks = String(form.get("secondaryRisks") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!geometry) {
      setError("Draw the affected polygon first so the warning can be geofenced to nearby citizens.");
      setMessage(null);
      return;
    }

    if (!hasAwsConfig) {
      setError("Live backend is not configured, so disasters cannot be created from the government portal yet.");
      setMessage(null);
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
            title,
            type,
            severity,
            description: description || null,
            affectedArea: geometry,
            secondaryRisks: secondaryRisks.length ? secondaryRisks : null
          }
        }
      });

      const createdDisaster = (result as any).data?.createDisaster as { id?: string } | undefined;
      if (!createdDisaster?.id) {
        throw new Error("The backend did not return the created disaster.");
      }

      setLatestIncidentTitle(title);
      setPendingWarning({
        disasterId: createdDisaster.id,
        disasterTitle: title,
        targetArea: geometry,
        alertTitle: "CrisisConnect warning",
        alertBody: buildWarningBody(title, description, warningMessage)
      });
      setMessage("Disaster created. Review the drafted SMS below and use Send warning when you are ready.");
      formElement.reset();
      setGeometry("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the disaster.");
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

      setMessage(`SMS warning queued for citizens in the affected area via ${alertResult.channel}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the warning SMS.");
    } finally {
      setSendingWarning(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardTitle>Register a disaster</CardTitle>
        <CardDescription className="mt-2">
          Draw the affected area polygon and publish a new incident to all portals.
        </CardDescription>
        <div className="mt-6">
          <MapDraw onGeometryChange={setGeometry} />
        </div>
      </Card>

      <Card>
        <CardTitle>Disaster details</CardTitle>
        <CardDescription className="mt-2">
          Create the disaster first, then use the government-only warning button to queue geofenced SMS alerts.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="title" placeholder="Incident title" required />
          <Input name="type" placeholder="Type (flood, landslide, earthquake...)" required />
          <select className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm" name="severity">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <textarea
            className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="description"
            placeholder="Operational description"
          />
          <Input name="secondaryRisks" placeholder="Secondary risks (comma separated)" />
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="warningMessage"
            placeholder="Optional SMS warning copy. Leave blank to auto-draft from the disaster description."
          />
          <Input name="affectedArea" placeholder="Drawn polygon GeoJSON" readOnly value={geometry} />
          <Button className="w-full" type="submit">
            {saving ? "Registering..." : "Register disaster"}
          </Button>
        </form>
        {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

        {pendingWarning ? (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="font-medium text-white">Warning ready for {pendingWarning.disasterTitle}</p>
            <p className="mt-2 text-sm text-slate-200">{pendingWarning.alertBody}</p>
            <Button className="mt-4 w-full" disabled={sendingWarning} onClick={onSendWarning} variant="warning">
              {sendingWarning ? "Sending warning..." : "Send warning SMS"}
            </Button>
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="font-medium text-white">Latest incident</p>
          <p className="mt-2 text-sm text-muted">{latestIncidentTitle}</p>
        </div>
      </Card>
    </div>
  );
}
