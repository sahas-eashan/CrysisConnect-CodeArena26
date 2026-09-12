"use client";

import { useEffect, useState } from "react";
import { Bot, ShieldAlert } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getCitizenGuidance } from "@/lib/ai-client";
import type { CitizenGuidance } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function CitizenGuidanceCard({ disasterId }: { disasterId?: string | null }) {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const { isReady, user } = useAuth();
  const [guidance, setGuidance] = useState<CitizenGuidance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (hasAwsConfig && isReady && !user) {
      setGuidance(null);
      setLoading(false);
      setError("Sign in with a Cognito account to use live AI guidance.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setGuidance(await getCitizenGuidance(disasterId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI safety guidance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasAwsConfig && !isReady) {
      return;
    }

    void load();
  }, [disasterId, hasAwsConfig, isReady, user]);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI powered safety guidance</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {guidance?.title ?? "Personalized safety guidance"}
          </CardTitle>
          <CardDescription className="mt-2">
            Role-aware multilingual recommendations grounded in current CrisisConnect disaster, shelter, and resource data.
          </CardDescription>
        </div>
        <Button disabled={hasAwsConfig && isReady && !user} onClick={() => void load()} variant="outline">
          Refresh
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Generating guidance...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {guidance ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">English</p>
            <p className="mt-2 text-sm text-slate-300">{guidance.guidance.english}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Sinhala</p>
              <p className="mt-2 text-sm text-slate-300">{guidance.guidance.sinhala}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Tamil</p>
              <p className="mt-2 text-sm text-slate-300">{guidance.guidance.tamil}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-sm font-medium text-white">Recommended next steps</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {guidance.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <Badge>{guidance.meta.status === "completed" ? "Gemini live" : guidance.meta.status}</Badge>
            <Badge>{Math.round(guidance.meta.confidence * 100)}% confidence</Badge>
            <Badge>Sources: {guidance.meta.sourceIds.join(", ") || "live context"}</Badge>
            {guidance.meta.warnings.length ? (
              <span className="inline-flex items-center gap-1 text-amber-200">
                <ShieldAlert className="h-3.5 w-3.5" />
                {guidance.meta.warnings[0]}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
