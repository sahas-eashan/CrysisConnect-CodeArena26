"use client";

import { useCallback, useState } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/hooks/use-subscription";
import { subscriptions } from "@/lib/aws/graphql/operations";
import { mockNews } from "@/lib/mock-data";

export default function CitizenNewsPage() {
  const [status, setStatus] = useState("Listening for live news updates...");
  const onMessage = useCallback(() => {
    setStatus("Live news update received from AppSync.");
  }, []);

  useSubscription(subscriptions.onNewNews, onMessage);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>News and public advisories</CardTitle>
        <CardDescription className="mt-2">
          Government and NGO updates stream here in real time through AppSync subscriptions.
        </CardDescription>
        <p className="mt-3 text-sm text-primary">{status}</p>
        <div className="mt-6 space-y-4">
          {mockNews.map((item) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={item.id}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <span className="text-xs uppercase tracking-wide text-primary">{item.category}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.content}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
