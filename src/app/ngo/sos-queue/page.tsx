"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { NgoSosAiAssist } from "@/components/ai/ngo-ai-assist";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import type { SOSSignal } from "@/lib/types";

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

export default function NgoSOSQueuePage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [signals, setSignals] = useState<SOSSignal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState(
    hasAwsConfig ? "Loading live SOS queue from the backend..." : "Live backend is not configured."
  );
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setSignals([]);
      return;
    }

    configureAmplify();
    const client = generateClient();
    let active = true;

    async function loadQueue(message?: string) {
      try {
        if (active) {
          setLoading(true);
          setError(null);
          if (message) setLiveMessage(message);
        }

        const result = await client.graphql({
          query: queries.getSOSSignals,
          authMode: "userPool"
        });

        if (!active) return;

        const nextSignals = ((result as any).data?.getSOSSignals ?? []) as SOSSignal[];
        setSignals(sortSignals(nextSignals));
        setLiveMessage("Live SOS queue loaded from the backend.");
      } catch (loadError) {
        if (!active) return;

        setSignals([]);
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load the live SOS queue from the backend.";
        setError(
          message.includes("Unauthorized")
            ? "This Cognito account is not in the NGO or government group, so live SOS signals cannot be loaded here."
            : message
        );
        setLiveMessage("Unable to load live SOS updates.");
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
        void loadQueue("New SOS received. Refreshing queue...");
      },
      error: (subscriptionError: unknown) => console.error("SOS subscription error", subscriptionError)
    });

    const unsubscribeUpdates = (client.graphql({
      query: subscriptions.onSOSUpdate,
      authMode: "userPool"
    }) as any).subscribe({
      next: () => {
        void loadQueue("SOS update received. Refreshing queue...");
      },
      error: (subscriptionError: unknown) => console.error("SOS update subscription error", subscriptionError)
    });

    return () => {
      active = false;
      unsubscribeNew.unsubscribe();
      unsubscribeUpdates.unsubscribe();
    };
  }, [hasAwsConfig]);

  async function onAccept(signalId: string) {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setAcceptingId(signalId);
      setError(null);

      const result = await client.graphql({
        query: mutations.acceptSOS,
        authMode: "userPool",
        variables: { id: signalId }
      });

      const updatedSignal = (result as any).data?.acceptSOS as SOSSignal | undefined;
      if (!updatedSignal?.id) {
        throw new Error("The backend did not return the updated SOS signal.");
      }

      setSignals((current) =>
        sortSignals(current.map((signal) => (signal.id === signalId ? { ...signal, ...updatedSignal } : signal)))
      );
      setLiveMessage("Dispatch accepted and saved to the backend.");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept the SOS dispatch.");
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <NgoSosAiAssist sosId={signals[0]?.id} />

      <Card>
        <CardTitle>Live SOS queue</CardTitle>
        <CardDescription className="mt-2">
          New emergencies are loaded from the database and refreshed through AppSync subscriptions.
        </CardDescription>
        <p className="mt-3 text-sm text-primary">{liveMessage}</p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {signals.map((signal) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={signal.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{signal.type}</p>
                  <p className="mt-1 text-sm text-muted">{signal.description}</p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  {signal.status}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <Button
                  disabled={acceptingId === signal.id || (signal.status ?? "").toLowerCase() !== "pending"}
                  onClick={() => void onAccept(signal.id)}
                >
                  {acceptingId === signal.id
                    ? "Saving..."
                    : (signal.status ?? "").toLowerCase() === "pending"
                      ? "Accept dispatch"
                      : "Already assigned"}
                </Button>
                <Link href="/ngo/map">
                  <Button variant="outline">View on map</Button>
                </Link>
              </div>
              {signal.nearestResponders?.length ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm font-medium text-white">Suggested responders</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    {signal.nearestResponders.map((responder) => (
                      <div className="flex items-center justify-between gap-3" key={responder.id}>
                        <span>{responder.fullName ?? responder.id}</span>
                        <span>{responder.distance != null ? `${Math.round(responder.distance)} m` : "Nearby"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {!signals.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No live SOS signals were found in the database.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
