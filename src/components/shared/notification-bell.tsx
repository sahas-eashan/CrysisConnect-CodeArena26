"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellRing, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

export function NotificationBell() {
  const pathname = usePathname();
  const { alerts, alertsError, loading, news, newsError, refresh, status } = useLiveFeed();
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () =>
      [
        ...alerts.slice(0, 3).map((alert) => ({
          id: `alert-${alert.id}`,
          kind: "Alert",
          title: alert.title,
          body: alert.body,
          createdAt: alert.createdAt
        })),
        ...news.slice(0, 2).map((entry) => ({
          id: `news-${entry.id}`,
          kind: "News",
          title: entry.title,
          body: entry.content,
          createdAt: entry.createdAt
        }))
      ].sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      }),
    [alerts, news]
  );

  const destination = pathname.startsWith("/admin") ? "/admin/alerts" : "/citizen/news";
  const count = items.length;

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Open notifications"
        className="relative rounded-2xl border border-white/10 bg-white/5 p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.25)] transition hover:border-primary/30 hover:bg-primary/10"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {count > 0 ? <BellRing className="h-5 w-5 text-slate-100" /> : <Bell className="h-5 w-5 text-slate-200" />}
        {count > 0 ? (
          <Badge className="absolute -right-2 -top-2 border-danger bg-danger text-white shadow-[0_8px_18px_rgba(239,68,68,0.35)]">
            {count > 9 ? "9+" : count}
          </Badge>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[25rem] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(6,10,19,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Live notifications</p>
              <p className="mt-1 text-xs text-muted">{status}</p>
            </div>
            <button
              className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
              onClick={() => void refresh("Refreshing alerts and field updates...")}
              type="button"
            >
              Refresh
            </button>
          </div>

          {alertsError || newsError ? (
            <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-red-200">
              {alertsError ?? newsError}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {loading && !items.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
                Loading notifications...
              </div>
            ) : null}

            {!loading && !items.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
                No live alerts or field updates yet.
              </div>
            ) : null}

            {items.map((item) => (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Radio className={`h-4 w-4 ${item.kind === "Alert" ? "text-red-300" : "text-sky-300"}`} />
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">{item.kind}</p>
                  </div>
                  <span className="text-[11px] text-muted">{formatTimestamp(item.createdAt)}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Link
              className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition hover:bg-primary/20"
              href={destination}
              onClick={() => setOpen(false)}
            >
              Open full notification feed
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
