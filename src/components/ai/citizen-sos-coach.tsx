"use client";

import { useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";

import { prepareSosSubmission } from "@/lib/ai-client";
import type { PreparedSosSubmission } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function CitizenSosCoach({
  type,
  description,
  onApplyRefined
}: {
  type: string;
  description: string;
  onApplyRefined?: (value: string) => void;
}) {
  const [result, setResult] = useState<PreparedSosSubmission | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPrepare() {
    try {
      setLoading(true);
      setError(null);
      setResult(await prepareSosSubmission({ type, description }));
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Unable to prepare SOS guidance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI powered SOS coach</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Refine before you send
          </CardTitle>
          <CardDescription className="mt-2">
            AI rewrites your message into a clearer responder-facing summary, but you still review it before anything is sent.
          </CardDescription>
        </div>
        <Button
          className="rounded-full px-5 py-2.5 whitespace-nowrap"
          disabled={loading || !description.trim()}
          onClick={() => void onPrepare()}
        >
          {loading ? "Preparing..." : "Prepare with AI"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {!description.trim() ? <p className="mt-4 text-sm text-muted">Add a situation note to activate SOS coaching.</p> : null}

      {result ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">Prepared SOS summary</p>
            <p className="mt-2 text-sm text-slate-300">{result.refined}</p>
            {onApplyRefined ? (
              <div className="mt-4">
                <Button className="rounded-full px-5 py-2.5 whitespace-nowrap" onClick={() => onApplyRefined(result.refined)}>
                  Use AI summary in my SOS
                </Button>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Sinhala</p>
              <p className="mt-2 text-sm text-slate-300">{result.translations.sinhala}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Tamil</p>
              <p className="mt-2 text-sm text-slate-300">{result.translations.tamil}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">Human review checklist</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {result.checklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <Badge>{Math.round(result.meta.confidence * 100)}% confidence</Badge>
            <Badge>{result.meta.requiresHumanApproval ? "Human review required" : "Ready"}</Badge>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
