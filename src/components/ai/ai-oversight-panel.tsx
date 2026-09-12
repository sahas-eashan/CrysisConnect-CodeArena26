"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

import { getAiAuditLogs, reviewAiAuditLog } from "@/lib/ai-client";
import type { AiAuditRef } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export function AiOversightPanel() {
  const [logs, setLogs] = useState<AiAuditRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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

  async function handleReview(id: string, approved: boolean) {
    try {
      setReviewingId(id);
      setError(null);
      const updated = await reviewAiAuditLog(id, approved);
      setLogs((current) => current.map((log) => (log.id === id ? updated : log)));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to save AI review.");
    } finally {
      setReviewingId(null);
    }
  }

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
                <Badge
                  className={
                    log.reviewStatus === "approved"
                      ? "border-success/40 bg-success/15 text-success"
                      : log.reviewStatus === "rejected"
                        ? "border-danger/40 bg-danger/15 text-danger"
                        : "border-secondary/40 bg-secondary/10 text-secondary"
                  }
                >
                  {log.reviewStatus ?? "pending_review"}
                </Badge>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="rounded-full px-4 py-2"
                disabled={reviewingId === log.id || log.reviewStatus === "approved"}
                onClick={() => void handleReview(log.id, true)}
                variant="success"
              >
                {reviewingId === log.id ? "Saving..." : log.reviewStatus === "approved" ? "Approved" : "Approve"}
              </Button>
              <Button
                className="rounded-full px-4 py-2"
                disabled={reviewingId === log.id || log.reviewStatus === "rejected"}
                onClick={() => void handleReview(log.id, false)}
                variant="danger"
              >
                {reviewingId === log.id ? "Saving..." : log.reviewStatus === "rejected" ? "Rejected" : "Reject"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
