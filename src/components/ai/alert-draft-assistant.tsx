"use client";

import { useMemo, useState } from "react";
import { Bot } from "lucide-react";

import { generateAlertDraft } from "@/lib/ai-client";
import type { AlertDraft } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AlertDraftAssistantProps = {
  title: string;
  body: string;
  targetRoles: string;
  channels: string[];
  onApplyDraft: (draft: AlertDraft) => void;
};

export function AlertDraftAssistant({
  title,
  body,
  targetRoles,
  channels,
  onApplyDraft
}: AlertDraftAssistantProps) {
  const [draft, setDraft] = useState<AlertDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedTargetRoles = useMemo(
    () =>
      targetRoles
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [targetRoles]
  );

  async function onGenerate() {
    try {
      setLoading(true);
      setError(null);
      const nextDraft = await generateAlertDraft({
        title: title.trim() || "Emergency safety alert",
        body: body.trim() || "Emergency conditions are active. Follow official instructions and move to safety.",
        channel: channels.length ? channels : ["sms", "push"],
        targetRoles: normalizedTargetRoles.length ? normalizedTargetRoles : ["citizen"]
      });
      setDraft(nextDraft);
      onApplyDraft(nextDraft);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to generate AI alert draft.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_38%),linear-gradient(180deg,rgba(10,18,33,0.98),rgba(5,10,20,0.96))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI alert drafting</Badge>
          <div className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-white">Draft into current form</h3>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Generate multilingual alert copy and write it directly into the existing title, body, and channel inputs.
          </p>
        </div>
        <Button className="rounded-full px-5" disabled={loading} onClick={() => void onGenerate()}>
          {loading ? "Generating..." : "Generate draft"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {draft ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">Applied draft</p>
            <p className="mt-2 text-sm text-slate-300">{draft.english}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">AI metadata</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
              <Badge>{Math.round(draft.meta.confidence * 100)}% confidence</Badge>
              <Badge>{draft.meta.requiresHumanApproval ? "Human review required" : "Ready"}</Badge>
              <Badge>Audit: {draft.meta.audit.id}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sinhala</p>
                <p className="mt-1 text-sm text-slate-300">{draft.sinhala}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tamil</p>
                <p className="mt-1 text-sm text-slate-300">{draft.tamil}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
