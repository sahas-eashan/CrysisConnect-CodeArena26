"use client";

import { useState } from "react";
import { Bot } from "lucide-react";

import { recommendResourceDispatch, triageSosCase } from "@/lib/ai-client";
import type { ResourceDispatchPlan, SosTriage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function NgoSosAiAssist({ sosId }: { sosId?: string | null }) {
  const [triage, setTriage] = useState<SosTriage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAnalyze() {
    if (!sosId) return;

    setLoading(true);
    try {
      setError(null);
      setTriage(await triageSosCase(sosId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to analyze the selected SOS.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI triage assist</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            SOS review support
          </CardTitle>
          <CardDescription className="mt-2">
            Converts raw SOS signals into a severity, urgency, and responder recommendation package for operator review.
          </CardDescription>
        </div>
        <Button className="rounded-full px-5 py-2.5 whitespace-nowrap" disabled={!sosId || loading} onClick={() => void onAnalyze()}>
          {loading ? "Analyzing..." : "Analyze SOS"}
        </Button>
      </div>

      {!sosId ? <p className="mt-4 text-sm text-muted">No live SOS signal is available to analyze yet.</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {triage ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <Badge>{triage.severity}</Badge>
            <Badge>{triage.urgency}</Badge>
            <Badge>{Math.round(triage.meta.confidence * 100)}% confidence</Badge>
            <Badge>{triage.meta.requiresHumanApproval ? "Human review required" : "Ready"}</Badge>
          </div>
          <p className="text-sm text-slate-300">{triage.rationale.summary}</p>
          {triage.recommendations.map((recommendation) => (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3" key={recommendation.title}>
              <p className="font-medium text-white">{recommendation.title}</p>
              <p className="mt-2 text-sm text-slate-300">{recommendation.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function NgoResourceAiAssist({
  requestId,
  requestSummary
}: {
  requestId?: string | null;
  requestSummary?: {
    resourceName: string;
    quantityNeeded: number;
    urgency: string;
  } | null;
}) {
  const [plan, setPlan] = useState<ResourceDispatchPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAnalyze() {
    if (!requestId) return;

    setLoading(true);
    try {
      setError(null);
      setPlan(await recommendResourceDispatch(requestId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to analyze the selected request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI dispatch assist</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Resource match recommendations
          </CardTitle>
          <CardDescription className="mt-2">
            Suggests what to dispatch and what still needs human confirmation before field action.
          </CardDescription>
        </div>
        <Button className="rounded-full px-5 py-2.5 whitespace-nowrap" disabled={!requestId || loading} onClick={() => void onAnalyze()}>
          {loading ? "Analyzing..." : "Analyze request"}
        </Button>
      </div>

      {requestSummary ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <p className="text-sm font-medium text-white">{requestSummary.resourceName}</p>
          <p className="mt-1 text-xs text-muted">
            Needs {requestSummary.quantityNeeded} units • {(requestSummary.urgency ?? "normal").toLowerCase()} priority
          </p>
        </div>
      ) : null}

      {!requestId ? <p className="mt-4 text-sm text-muted">No live pending request is available to analyze yet.</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {plan ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <Badge>{Math.round(plan.meta.confidence * 100)}% confidence</Badge>
            <Badge>{plan.meta.requiresHumanApproval ? "Human review required" : "Ready"}</Badge>
          </div>
          <p className="text-sm text-slate-300">{plan.rationale.summary}</p>
          {plan.recommendations.map((recommendation) => (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3" key={recommendation.title}>
              <p className="font-medium text-white">{recommendation.title}</p>
              <p className="mt-2 text-sm text-slate-300">{recommendation.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
