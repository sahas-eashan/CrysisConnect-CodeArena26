"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { NgoSosAiAssist } from "@/components/ai/ngo-ai-assist";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import type { SOSSignal } from "@/lib/types";
import { cn, toTitleCase } from "@/lib/utils";

function sortSignals(signals: SOSSignal[]) {
  const statusWeight: Record<string, number> = {
    pending: 0,
    assigned: 1,
    in_progress: 2,
    resolved: 3
  };

  return [...signals].sort((left, right) => {
    const leftStatus = statusWeight[left.status?.toLowerCase() ?? "pending"] ?? 4;
    const rightStatus = statusWeight[right.status?.toLowerCase() ?? "pending"] ?? 4;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

function statusTone(status?: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "assigned":
      return "border border-sky-400/30 bg-sky-500/15 text-sky-100";
    case "resolved":
      return "border border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    default:
      return "border border-red-400/30 bg-red-500/15 text-red-200";
  }
}

export default function AdminSOSQueuePage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [signals, setSignals] = useState<SOSSignal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [message, setMessage] = useState(
    hasAwsConfig ? "Loading live SOS queue..." : "Live backend is not configured."
  );
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setSignals([]);
      return;
    }

    configureAmplify();
    const client = generateClient();
    let active = true;

    async function loadQueue(nextMessage?: string) {
      try {
        if (active) {
          setLoading(true);
          setError(null);
          if (nextMessage) setMessage(nextMessage);
        }

        const result = await client.graphql({
          query: queries.getSOSSignals,
          authMode: "userPool"
        });

        if (!active) return;

        const nextSignals = ((result as any).data?.getSOSSignals ?? []) as SOSSignal[];
        setSignals(sortSignals(nextSignals));
        setMessage("Government SOS queue is synced with live backend events.");
      } catch (loadError) {
        if (!active) return;
        setSignals([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load the live SOS queue.");
        setMessage("Unable to sync SOS queue.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadQueue();

    const unsubscribeNew = (client.graphql({
      query: subscriptions.onNewSOS,
      authMode: "userPool"
    }) as any).subscribe({
      next: () => {
        void loadQueue("New SOS received. Refreshing command queue...");
      },
      error: (subscriptionError: unknown) => console.error("Government SOS subscription error", subscriptionError)
    });

    const unsubscribeUpdates = (client.graphql({
      query: subscriptions.onSOSUpdate,
      authMode: "userPool"
    }) as any).subscribe({
      next: () => {
        void loadQueue("SOS status update received. Refreshing queue...");
      },
      error: (subscriptionError: unknown) => console.error("Government SOS update subscription error", subscriptionError)
    });

    return () => {
      active = false;
      unsubscribeNew.unsubscribe();
      unsubscribeUpdates.unsubscribe();
    };
  }, [hasAwsConfig]);

  const pendingCount = useMemo(
    () => signals.filter((signal) => (signal.status ?? "pending").toLowerCase() === "pending").length,
    [signals]
  );

  async function onStatusChange(id: string, action: "accept" | "resolve") {
    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();

    try {
      setActingId(id);
      setError(null);

      const result = await client.graphql({
        query: action === "accept" ? mutations.acceptSOS : mutations.resolveSOS,
        authMode: "userPool",
        variables: { id }
      });

      const key = action === "accept" ? "acceptSOS" : "resolveSOS";
      const updatedSignal = (result as any).data?.[key] as SOSSignal | undefined;
      if (!updatedSignal?.id) {
        throw new Error("The backend did not return the updated SOS signal.");
      }

      setSignals((current) =>
        sortSignals(current.map((signal) => (signal.id === id ? { ...signal, ...updatedSignal } : signal)))
      );
      setMessage(action === "accept" ? "Dispatch accepted by government command." : "SOS marked as resolved.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update the SOS status.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-red-400/20 bg-gradient-to-br from-red-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Open SOS</CardTitle>
          <CardDescription className="mt-2">Signals still waiting for assignment.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{pendingCount}</p>
        </Card>
        <Card className="border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Total queue</CardTitle>
          <CardDescription className="mt-2">All signals currently visible to command.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{signals.length}</p>
        </Card>
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Command routing</CardTitle>
          <CardDescription className="mt-2">Review signal detail, see responders, and open the command map.</CardDescription>
          <p className="mt-6 text-sm text-slate-300">Live subscriptions keep this queue current.</p>
        </Card>
      </div>

      <NgoSosAiAssist sosId={signals[0]?.id} />

      <Card>
        <CardTitle>Government SOS queue</CardTitle>
        <CardDescription className="mt-2">
          Review incoming emergency signals, assign command attention, and close incidents after resolution.
        </CardDescription>
        <p className="mt-3 text-sm text-primary">{message}</p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {signals.map((signal) => {
            const status = (signal.status ?? "pending").toLowerCase();

            return (
              <div
                id={signal.id}
                className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.12),transparent_36%),linear-gradient(180deg,rgba(13,21,37,0.98),rgba(7,12,24,0.95))] p-5"
                key={signal.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-white">{toTitleCase(signal.type ?? "SOS")}</p>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-medium", statusTone(signal.status))}>
                        {toTitleCase(status.replace(/_/g, " "))}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{signal.description ?? "No additional detail provided."}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        ID: {signal.id}
                      </span>
                      {signal.createdAt ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          Created: {new Date(signal.createdAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      className="rounded-full px-5"
                      disabled={actingId === signal.id || status !== "pending"}
                      onClick={() => void onStatusChange(signal.id, "accept")}
                    >
                      {actingId === signal.id && status === "pending" ? "Saving..." : status === "pending" ? "Accept dispatch" : "Assigned"}
                    </Button>
                    <Button
                      className="rounded-full px-5"
                      disabled={actingId === signal.id || status === "resolved"}
                      onClick={() => void onStatusChange(signal.id, "resolve")}
                      variant="success"
                    >
                      {actingId === signal.id && status !== "pending" ? "Saving..." : status === "resolved" ? "Resolved" : "Mark resolved"}
                    </Button>
                    <Link href="/admin/map">
                      <Button className="rounded-full px-5" variant="outline">
                        View map
                      </Button>
                    </Link>
                  </div>
                </div>

                {signal.nearestResponders?.length ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="text-sm font-medium text-white">Closest responders</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {signal.nearestResponders.map((responder) => (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3" key={responder.id}>
                          <p className="text-sm font-medium text-white">{responder.fullName ?? responder.id}</p>
                          <p className="mt-1 text-xs text-muted">
                            {responder.distance != null ? `${Math.round(responder.distance)} m away` : "Nearby"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {!signals.length && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-muted">
              No live SOS signals were found in the backend.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
