"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { CitizenGuidanceCard } from "@/components/ai/citizen-guidance-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useLiveFeed } from "@/hooks/use-live-feed";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import type { DashboardStats, Disaster, SafeZone } from "@/lib/types";
import { percent } from "@/lib/utils";

const emptyStats: DashboardStats = {
  activeDisasters: 0,
  pendingSOS: 0,
  totalResources: 0,
  totalSafeZones: 0,
  totalUsers: 0
};

export default function CitizenDashboardPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const { alerts, loading, news } = useLiveFeed();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [disaster, setDisaster] = useState<Disaster | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latestAlert = alerts[0] ?? null;
  const latestNews = news[0] ?? null;

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadDashboard() {
      configureAmplify();
      const client = generateClient();

      try {
        setError(null);

        const [statsResult, disastersResult, safeZonesResult] = await Promise.all([
          client.graphql({ query: queries.getDashboardStats, authMode: "userPool" }),
          client.graphql({
            query: queries.getDisasters,
            authMode: "userPool",
            variables: { status: "active" }
          }),
          client.graphql({ query: queries.getSafeZones, authMode: "userPool" })
        ]);

        if (!active) return;

        setStats(((statsResult as any).data?.getDashboardStats ?? emptyStats) as DashboardStats);

        const nextDisasters = ((disastersResult as any).data?.getDisasters ?? []) as Disaster[];
        setDisaster(nextDisasters[0] ?? null);
        setSafeZones(((safeZonesResult as any).data?.getSafeZones ?? []) as SafeZone[]);
      } catch (loadError) {
        if (!active) return;
        setStats(emptyStats);
        setDisaster(null);
        setSafeZones([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load the live citizen dashboard.");
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  return (
    <div className="space-y-6">
      <CitizenGuidanceCard disasterId={disaster?.id} />

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard helper="Currently affecting the region." label="Active disasters" value={stats.activeDisasters} />
        <StatCard helper="Citizens, NGOs, and officials on the platform." label="Registered users" value={stats.totalUsers} />
        <StatCard helper="Live shelter inventory." label="Safe zones" value={stats.totalSafeZones} />
        <StatCard helper="Pending community requests." label="Open aid requests" value={stats.pendingSOS} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardTitle>Nearest safe zones</CardTitle>
          <CardDescription className="mt-2">
            Capacity-aware shelter suggestions that avoid already crowded camps.
          </CardDescription>
          <div className="mt-6 space-y-4">
            {safeZones.map((zone) => (
              <Link
                className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-primary/60 hover:bg-slate-950/70"
                href={`/citizen/map?safeZone=${zone.id}`}
                key={zone.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{zone.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      Amenities: {zone.amenities?.join(", ") ?? "General shelter support"}
                    </p>
                  </div>
                  <Badge>{zone.status}</Badge>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted">
                    <span>Occupancy</span>
                    <span>
                      {zone.currentOccupancy}/{zone.capacity}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-900">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percent(zone.currentOccupancy, zone.capacity)}%` }}
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs text-primary">Open on live map</p>
              </Link>
            ))}
            {!safeZones.length ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
                No live safe zones are currently available.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle>Primary incident</CardTitle>
          <CardDescription className="mt-2">
            Real-time public brief from the command center.
          </CardDescription>
          <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{disaster?.title ?? "No active disaster available"}</p>
                <p className="mt-2 text-sm text-slate-200">
                  {disaster?.description ?? "The live backend did not return an active public incident brief."}
                </p>
              </div>
              <Badge className="border-danger/40 bg-danger/10 text-red-200">{disaster?.severity ?? "unknown"}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(disaster?.secondaryRisks ?? []).map((risk) => (
                <Badge key={risk}>{risk}</Badge>
              ))}
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-sm font-medium text-white">Latest emergency alert</p>
            {latestAlert ? (
              <>
                <p className="mt-2 text-sm text-muted">{latestAlert.title}</p>
                <p className="mt-3 text-sm text-slate-300">{latestAlert.body}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {loading ? "Loading alert data from the backend..." : "No live alerts found in the database."}
              </p>
            )}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-sm font-medium text-white">Latest public notice</p>
            {latestNews ? (
              <>
                <p className="mt-2 text-sm text-muted">{latestNews.title}</p>
                <p className="mt-3 text-sm text-slate-300">{latestNews.content}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {loading ? "Loading news data from the backend..." : "No live news updates found in the database."}
              </p>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/citizen/map">
              <Button>Get me to safety</Button>
            </Link>
            <Link href="/citizen/resources">
              <Button variant="outline">Request essentials</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
