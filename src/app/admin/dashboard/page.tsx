"use client";

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
            What the government control room needs to act on right now.
          </CardDescription>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">Review new NGO approval requests and onboard verified logistics partners.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">Push contamination advisories to citizens within the active flood polygon.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">Reallocate medical kits to the highest SOS density cluster.</div>
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
    </div>
  );
}
