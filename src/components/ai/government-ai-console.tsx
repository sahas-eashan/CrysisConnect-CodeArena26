"use client";

import { useEffect, useState } from "react";
import { Bot, FileSearch, Siren } from "lucide-react";

import { generateIncidentBrief, recommendOperations } from "@/lib/ai-client";
import type { IncidentBrief, OperationsRecommendationSet } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function GovernmentAiConsole({ disasterId }: { disasterId?: string | null }) {
  const [brief, setBrief] = useState<IncidentBrief | null>(null);
  const [operations, setOperations] = useState<OperationsRecommendationSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [nextBrief, nextOperations] = await Promise.all([
        generateIncidentBrief(disasterId),
        recommendOperations("next_6_hours")
      ]);
      setBrief(nextBrief);
      setOperations(nextOperations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI command console.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [disasterId]);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI command copilot</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Live command review
          </CardTitle>
          <CardDescription className="mt-2">
            Incident summarization and operations ranking are generated from live CrisisConnect records, but public actions still require human approval.
          </CardDescription>
        </div>
        <Button onClick={() => void load()} variant="outline">
          Refresh
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Analyzing current operations...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-white">Incident brief</p>
          </div>
          <p className="mt-3 text-lg font-semibold text-white">{brief?.headline}</p>
          <p className="mt-3 text-sm text-slate-300">{brief?.summary}</p>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {brief?.rationale.bullets.map((bullet) => (
              <p key={bullet}>{bullet}</p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-white">Top next actions</p>
          </div>
          <div className="mt-4 space-y-3">
            {operations?.recommendations.map((recommendation) => (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3" key={recommendation.title}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{recommendation.title}</p>
                  <Badge>{recommendation.priority}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{recommendation.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {brief ? (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          <Badge>{Math.round(brief.meta.confidence * 100)}% confidence</Badge>
          <Badge>{brief.meta.requiresHumanApproval ? "Human review required" : "Autonomous"}</Badge>
          <Badge>Audit: {brief.meta.audit.id}</Badge>
        </div>
      ) : null}
    </Card>
  );
}
