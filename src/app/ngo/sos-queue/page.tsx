"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/hooks/use-subscription";
import { mockSOSSignals } from "@/lib/mock-data";
import { subscriptions } from "@/lib/aws/graphql/operations";

export default function NgoSOSQueuePage() {
  const [accepted, setAccepted] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("Waiting for AppSync events...");

  const onMessage = useCallback(() => {
    setLiveMessage("Live SOS event received from AppSync subscription.");
  }, []);

  useSubscription(subscriptions.onNewSOS, onMessage);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Live SOS queue</CardTitle>
        <CardDescription className="mt-2">
          AppSync subscriptions push new emergencies here instantly so responders can claim them.
        </CardDescription>
        <p className="mt-3 text-sm text-primary">{liveMessage}</p>
        <div className="mt-6 space-y-4">
          {mockSOSSignals.map((signal) => (
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
                <Button onClick={() => setAccepted(signal.id)}>Accept dispatch</Button>
                <Button variant="outline">View on map</Button>
              </div>
              {accepted === signal.id ? (
                <p className="mt-3 text-sm text-success">
                  Dispatch accepted. In live mode `acceptSOS` updates the record and notifies the citizen immediately.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
