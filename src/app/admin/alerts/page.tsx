"use client";

import { FormEvent, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations } from "@/lib/aws/graphql/operations";

export default function AdminAlertsPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const channels = form
      .getAll("channel")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const targetRoles = String(form.get("targetRoles") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const targetArea = String(form.get("targetArea") ?? "").trim();

    if (!channels.length) {
      setError("Select at least one delivery channel.");
      return;
    }

    if (!hasAwsConfig) {
      setMessage("Live backend is not configured, so this alert cannot be saved to the database.");
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.sendAlert,
        authMode: "userPool",
        variables: {
          input: {
            title: String(form.get("title") ?? "").trim(),
            body: String(form.get("body") ?? "").trim(),
            channel: channels,
            targetArea: targetArea || null,
            targetRoles: targetRoles.length ? targetRoles : null
          }
        }
      });

      const alertResult = (result as any).data?.sendAlert as { sent?: number; channel?: string } | undefined;
      if (alertResult?.sent == null) {
        throw new Error("The backend did not confirm the alert delivery payload.");
      }

      formElement.reset();
      setMessage(`Alert saved to the database and dispatched across ${alertResult.sent} channel(s): ${alertResult.channel ?? channels.join(", ")}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send the alert.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardTitle>Broadcast emergency alert</CardTitle>
        <CardDescription className="mt-2">
          Choose channels and affected roles. The backend geofences delivery based on the selected polygon.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="title" placeholder="Alert title" required />
          <textarea
            className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="body"
            placeholder="Alert body"
            required
          />
          <Input name="targetArea" placeholder='Target polygon GeoJSON, e.g. {"type":"Polygon",...}' />
          <Input name="targetRoles" placeholder="Target roles (citizen, ngo, government)" />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
              <input className="mr-2" defaultChecked name="channel" type="checkbox" value="sms" />
              SMS
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
              <input className="mr-2" defaultChecked name="channel" type="checkbox" value="push" />
              Push
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
              <input className="mr-2" name="channel" type="checkbox" value="email" />
              Email
            </label>
          </div>
          <Button className="w-full" type="submit">
            {saving ? "Sending..." : "Send multi-channel alert"}
          </Button>
        </form>
        {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>

      <Card>
        <CardTitle>Secondary disaster automation</CardTitle>
        <CardDescription className="mt-2">
          Rule-based warnings are generated automatically when certain disaster types are registered.
        </CardDescription>
        <ul className="mt-6 space-y-3 text-sm text-slate-300">
          <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Earthquake near coast {"->"} tsunami watch</li>
          <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Flood {"->"} water contamination advisory</li>
          <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Drought {"->"} wildfire risk alert</li>
        </ul>
      </Card>
    </div>
  );
}
