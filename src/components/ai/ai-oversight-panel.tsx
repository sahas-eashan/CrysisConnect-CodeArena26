"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

import { getAiAuditLogs } from "@/lib/ai-client";
import type { AiAuditRef } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export function AiOversightPanel() {
  const [logs, setLogs] = useState<AiAuditRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setLogs(await getAiAuditLogs(20));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI oversight logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI oversight</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Audit and review trail
          </CardTitle>
        </div>
        <Button onClick={() => void load()} variant="outline">
          Refresh
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Loading AI audit events...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 space-y-3">
        {logs.map((log) => (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={log.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{log.action}</p>
                <p className="mt-1 text-xs text-muted">Audit ID: {log.id}</p>
                <p className="mt-1 text-xs text-muted">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{log.model}</Badge>
                <Badge>{log.status}</Badge>
                <Badge>{log.reviewStatus ?? "pending_review"}</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
