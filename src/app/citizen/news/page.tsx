"use client";

import { Badge } from "@/components/ui/badge";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useLiveFeed } from "@/hooks/use-live-feed";

function formatTimestamp(value?: string | null) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default function CitizenNewsPage() {
  const { alerts, alertsError, loading, news, newsError } = useLiveFeed();

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Emergency alerts</CardTitle>
        <CardDescription className="mt-2">Stored alerts from the `notifications` table appear here first.</CardDescription>
        {alertsError ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {alertsError}
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {alerts.map((item) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={item.id}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <Badge className="border-danger/40 bg-danger/10 text-red-200">
                  {(item.type ?? "alert").replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(item.channel ?? []).map((channel) => (
                  <Badge key={channel}>{channel}</Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">{formatTimestamp(item.createdAt)}</p>
            </div>
          ))}
          {!alerts.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No live alerts were found in the database.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Field news</CardTitle>
        <CardDescription className="mt-2">Verified reports from the `news_updates` table.</CardDescription>
        {newsError ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {newsError}
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {news.map((item) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={item.id}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <span className="text-xs uppercase tracking-wide text-primary">{item.category ?? "update"}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{item.content}</p>
              <p className="mt-3 text-xs text-muted">{formatTimestamp(item.createdAt)}</p>
            </div>
          ))}
          {!news.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No live news updates were found in the database.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
