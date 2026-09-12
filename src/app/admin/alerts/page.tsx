"use client";

import { FormEvent, useState } from "react";
import { generateClient } from "aws-amplify/api";
import { Radio, Siren } from "lucide-react";

import { AlertDraftAssistant } from "@/components/ai/alert-draft-assistant";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveFeed } from "@/hooks/use-live-feed";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations } from "@/lib/aws/graphql/operations";
import type { AlertDraft } from "@/lib/types";

function formatTimestamp(value?: string | null) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default function AdminAlertsPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const { alerts, alertsError, loading: alertsLoading, refresh } = useLiveFeed();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetArea, setTargetArea] = useState("");
  const [targetRoles, setTargetRoles] = useState("citizen");
  const [channels, setChannels] = useState<string[]>(["sms", "push"]);

  function updateChannel(channel: string, checked: boolean) {
    setChannels((current) =>
      checked ? [...new Set([...current, channel])] : current.filter((value) => value !== channel)
    );
  }

  function applyDraft(draft: AlertDraft) {
    setTitle(draft.title);
    setBody(draft.english);
    setChannels(draft.channel.length ? draft.channel : ["sms", "push"]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedChannels = channels.map((value) => value.trim()).filter(Boolean);
    const normalizedRoles = targetRoles
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!selectedChannels.length) {
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
            title: title.trim(),
            body: body.trim(),
            channel: selectedChannels,
            targetArea: targetArea.trim() || null,
            targetRoles: normalizedRoles.length ? normalizedRoles : null
          }
        }
      });

      const alertResult = (result as any).data?.sendAlert as { sent?: number; channel?: string } | undefined;
      if (alertResult?.sent == null) {
        throw new Error("The backend did not confirm the alert delivery payload.");
      }

      setTitle("");
      setBody("");
      setTargetArea("");
      setTargetRoles("citizen");
      setChannels(["sms", "push"]);
      void refresh("New alert broadcast saved. Refreshing live notifications...");
      setMessage(
        `Alert saved to the database and dispatched across ${alertResult.sent} channel(s): ${alertResult.channel ?? selectedChannels.join(", ")}`
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send the alert.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AlertDraftAssistant
        body={body}
        channels={channels}
        onApplyDraft={applyDraft}
        targetRoles={targetRoles}
        title={title}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="border-primary/20 bg-gradient-to-br from-slate-950/90 to-sky-950/30">
          <CardTitle>Broadcast emergency alert</CardTitle>
          <CardDescription className="mt-2">
            Publish the alert once, then track it in the live notification stream and stored broadcast history.
          </CardDescription>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Alert title"
              required
              value={title}
            />
            <textarea
              className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              name="body"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Alert body"
              required
              value={body}
            />
            <Input
              name="targetArea"
              onChange={(event) => setTargetArea(event.target.value)}
              placeholder='Target polygon GeoJSON, e.g. {"type":"Polygon",...}'
              value={targetArea}
            />
            <Input
              name="targetRoles"
              onChange={(event) => setTargetRoles(event.target.value)}
              placeholder="Target roles (citizen, ngo, government)"
              value={targetRoles}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
                <input
                  checked={channels.includes("sms")}
                  className="mr-2"
                  name="channel"
                  onChange={(event) => updateChannel("sms", event.target.checked)}
                  type="checkbox"
                  value="sms"
                />
                SMS
              </label>
              <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
                <input
                  checked={channels.includes("push")}
                  className="mr-2"
                  name="channel"
                  onChange={(event) => updateChannel("push", event.target.checked)}
                  type="checkbox"
                  value="push"
                />
                Push
              </label>
              <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
                <input
                  checked={channels.includes("email")}
                  className="mr-2"
                  name="channel"
                  onChange={(event) => updateChannel("email", event.target.checked)}
                  type="checkbox"
                  value="email"
                />
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

        <div className="space-y-6">
          <Card className="border-danger/20 bg-gradient-to-br from-slate-950/90 to-red-950/30">
            <div className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-red-300" />
              <CardTitle>Recent broadcasts</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Live notifications stored in the backend after command broadcast.
            </CardDescription>
            {alertsError ? (
              <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-200">
                {alertsError}
              </div>
            ) : null}
            <div className="mt-6 space-y-3">
              {alerts.slice(0, 5).map((item) => (
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4" key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{item.title}</p>
                    <span className="text-xs text-muted">{formatTimestamp(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(item.channel ?? []).map((channel) => (
                      <span
                        className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary"
                        key={channel}
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!alerts.length && !alertsLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                  No live broadcasts have been stored yet.
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <CardTitle>Notification routing</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Alerts are stored in `notifications`, published over AppSync subscriptions, and fanned out through the worker for SMS and email delivery.
            </CardDescription>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">AppSync updates in-app feeds and the shared navbar notification center.</li>
              <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Worker fan-out uses the configured SNS and SES channels for external delivery.</li>
              <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Role targeting keeps command alerts scoped to the right audience.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
