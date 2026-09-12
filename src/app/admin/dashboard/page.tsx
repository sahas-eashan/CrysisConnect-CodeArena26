"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { StatCard } from "@/components/dashboard/stat-card";
import { GovernmentAiConsole } from "@/components/ai/government-ai-console";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import type { DashboardStats, Disaster } from "@/lib/types";

const emptyStats: DashboardStats = {
  activeDisasters: 0,
  pendingSOS: 0,
  totalResources: 0,
  totalSafeZones: 0,
  totalUsers: 0
};

export default function AdminDashboardPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [primaryDisaster, setPrimaryDisaster] = useState<Disaster | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        const [statsResult, disastersResult] = await Promise.all([
          client.graphql({ query: queries.getDashboardStats, authMode: "userPool" }),
          client.graphql({
            query: queries.getDisasters,
            authMode: "userPool",
            variables: { status: "active" }
          })
        ]);

        if (!active) return;

        setStats(((statsResult as any).data?.getDashboardStats ?? emptyStats) as DashboardStats);

        const disasters = ((disastersResult as any).data?.getDisasters ?? []) as Disaster[];
        setPrimaryDisaster(disasters[0] ?? null);
      } catch (loadError) {
        if (!active) return;
        setStats(emptyStats);
        setPrimaryDisaster(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load the live command dashboard.");
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  return (
    <div className="space-y-6">
      <GovernmentAiConsole disasterId={primaryDisaster?.id} />

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active disasters" value={stats.activeDisasters} helper="Live incidents under command" />
        <StatCard label="Pending SOS" value={stats.pendingSOS} helper="Needs responder allocation" />
        <StatCard label="Tracked resources" value={stats.totalResources} helper="Cross-agency inventory" />
        <StatCard label="Safe zones" value={stats.totalSafeZones} helper="Shelters with capacity data" />
        <StatCard label="Registered users" value={stats.totalUsers} helper="Citizens, NGOs, and admins" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardTitle>Command priorities</CardTitle>
          <CardDescription className="mt-2">
            Active command actions pulled into one government workspace.
          </CardDescription>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <Link className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-sky-400/40 hover:bg-sky-500/10" href="/admin/approvals">
              Review pending partner approvals and onboard verified logistics teams.
            </Link>
            <Link className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-amber-400/40 hover:bg-amber-500/10" href="/admin/alerts">
              Draft and send public alerts across SMS, push, and email channels.
            </Link>
            <Link className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-red-400/40 hover:bg-red-500/10" href="/admin/sos-queue">
              Move through the live SOS queue and route command attention by urgency.
            </Link>
          </div>
        </Card>

        <Card>
          <CardTitle>Current primary disaster</CardTitle>
          <CardDescription className="mt-2">{primaryDisaster?.title ?? "No active disaster available"}</CardDescription>
          <p className="mt-4 text-sm text-slate-300">
            {primaryDisaster?.description ?? "The live backend did not return an active disaster summary."}
          </p>
        </Card>
      </div>

      <Card className="border-white/10 bg-gradient-to-r from-red-500/10 via-amber-400/10 to-emerald-500/10">
        <CardTitle>Command jumps</CardTitle>
        <CardDescription className="mt-2">
          Direct access to the main command surfaces.
        </CardDescription>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400"
            href="/admin/disasters"
          >
            Open disasters
          </Link>
          <Link
            className="inline-flex items-center rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-yellow-300"
            href="/admin/safe-zones"
          >
            Open safe zones
          </Link>
          <Link
            className="inline-flex items-center rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
            href="/admin/resources"
          >
            Open resources
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-sky-400/40 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/25"
            href="/admin/sos-queue"
          >
            Open live SOS queue
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            href="/admin/map"
          >
            View command map
          </Link>
        </div>
      </Card>
    </div>
  );
}
