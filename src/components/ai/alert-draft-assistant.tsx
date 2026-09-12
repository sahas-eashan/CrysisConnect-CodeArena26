"use client";

import { useState } from "react";
import { Bot } from "lucide-react";

import { generateAlertDraft } from "@/lib/ai-client";
import type { AlertDraft } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function AlertDraftAssistant() {
  const [draft, setDraft] = useState<AlertDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    try {
      setLoading(true);
      setError(null);
      setDraft(
        await generateAlertDraft({
          title: "Colombo Flood Safety Alert",
          body: "Flooding is active in low-lying areas. Move toward a safe zone and avoid contaminated water.",
          channel: ["sms", "push", "email"],
          targetRoles: ["citizen"]
        })
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to generate AI alert draft.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI alert drafting</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Multilingual draft assistant
          </CardTitle>
          <CardDescription className="mt-2">
            Generates reviewed alert copy for SMS, push, and email in English, Sinhala, and Tamil.
          </CardDescription>
        </div>
        <Button onClick={() => void onGenerate()}>{loading ? "Generating..." : "Generate draft"}</Button>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {draft ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="font-medium text-white">{draft.title}</p>
            <p className="mt-2 text-sm text-slate-300">{draft.english}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Sinhala</p>
              <p className="mt-2 text-sm text-slate-300">{draft.sinhala}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Tamil</p>
              <p className="mt-2 text-sm text-slate-300">{draft.tamil}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <Badge>{Math.round(draft.meta.confidence * 100)}% confidence</Badge>
            <Badge>{draft.meta.requiresHumanApproval ? "Human review required" : "Ready"}</Badge>
            <Badge>Audit: {draft.meta.audit.id}</Badge>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
