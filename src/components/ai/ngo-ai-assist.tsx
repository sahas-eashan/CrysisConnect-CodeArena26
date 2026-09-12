"use client";

import { useState } from "react";
import { Bot } from "lucide-react";

import { recommendResourceDispatch, triageSosCase } from "@/lib/ai-client";
import type { ResourceDispatchPlan, SosTriage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function NgoSosAiAssist({ sosId }: { sosId: string }) {
  const [triage, setTriage] = useState<SosTriage | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAnalyze() {
    setLoading(true);
    try {
      setTriage(await triageSosCase(sosId));
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
        <Button onClick={() => void onAnalyze()}>{loading ? "Analyzing..." : "Analyze SOS"}</Button>
      </div>

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

export function NgoResourceAiAssist({ requestId }: { requestId: string }) {
  const [plan, setPlan] = useState<ResourceDispatchPlan | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAnalyze() {
    setLoading(true);
    try {
      setPlan(await recommendResourceDispatch(requestId));
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
        <Button onClick={() => void onAnalyze()}>{loading ? "Analyzing..." : "Analyze request"}</Button>
      </div>

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
