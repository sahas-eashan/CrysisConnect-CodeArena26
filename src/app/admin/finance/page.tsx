"use client";

import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import type { DashboardStats, Resource, ResourceRequest, SOSSignal, SafeZone } from "@/lib/types";

type FinanceModelRow = {
  category: string;
  amount: number;
  driver: string;
};

const emptyStats: DashboardStats = {
  activeDisasters: 0,
  pendingSOS: 0,
  totalResources: 0,
  totalSafeZones: 0,
  totalUsers: 0
};

function currencyLabel(value: number) {
  return new Intl.NumberFormat("en-LK", {
    maximumFractionDigits: 0
  }).format(value);
}

function resourceStressCount(resources: Resource[]) {
  return resources.filter((resource) => {
    const status = (resource.status ?? "").toLowerCase();
    return status === "low" || status === "depleted";
  }).length;
}

function occupancyPressureCount(zones: SafeZone[]) {
  return zones.filter((zone) => zone.capacity > 0 && zone.currentOccupancy / zone.capacity >= 0.8).length;
}

function medicalSignalCount(signals: SOSSignal[]) {
  return signals.filter((signal) => (signal.type ?? "").toLowerCase().includes("medical")).length;
}

function urgentRequestCount(requests: ResourceRequest[]) {
  return requests.filter((request) => {
    const urgency = (request.urgency ?? "").toLowerCase();
    return urgency === "critical" || urgency === "high" || urgency === "urgent";
  }).length;
}

export default function AdminFinancePage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [resources, setResources] = useState<Resource[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [signals, setSignals] = useState<SOSSignal[]>([]);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadFinanceView() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);

        const [statsResult, resourcesResult, requestsResult, sosResult, safeZonesResult] = await Promise.allSettled([
          client.graphql({
            query: queries.getDashboardStats,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getResources,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getResourceRequests,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getSOSSignals,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getSafeZones,
            authMode: "userPool"
          })
        ]);

        if (!active) return;

        setStats(statsResult.status === "fulfilled" ? (((statsResult.value as any).data?.getDashboardStats ?? emptyStats) as DashboardStats) : emptyStats);
        setResources(resourcesResult.status === "fulfilled" ? (((resourcesResult.value as any).data?.getResources ?? []) as Resource[]) : []);
        setRequests(requestsResult.status === "fulfilled" ? (((requestsResult.value as any).data?.getResourceRequests ?? []) as ResourceRequest[]) : []);
        setSignals(sosResult.status === "fulfilled" ? (((sosResult.value as any).data?.getSOSSignals ?? []) as SOSSignal[]) : []);
        setZones(safeZonesResult.status === "fulfilled" ? (((safeZonesResult.value as any).data?.getSafeZones ?? []) as SafeZone[]) : []);

        const loadErrors = [
          statsResult.status === "rejected" ? statsResult.reason : null,
          resourcesResult.status === "rejected" ? resourcesResult.reason : null,
          requestsResult.status === "rejected" ? requestsResult.reason : null,
          sosResult.status === "rejected" ? sosResult.reason : null,
          safeZonesResult.status === "rejected" ? safeZonesResult.reason : null
        ]
          .map((item) => (item instanceof Error ? item.message : null))
          .filter((message): message is string => Boolean(message));

        setError(loadErrors[0] ?? null);
      } catch (loadError) {
        if (!active) return;

        setStats(emptyStats);
        setResources([]);
        setRequests([]);
        setSignals([]);
        setZones([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load command finance view.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFinanceView();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  const financeModel = useMemo<FinanceModelRow[]>(() => {
    const stressedResources = resourceStressCount(resources);
    const shelterPressure = occupancyPressureCount(zones);
    const medicalSignals = medicalSignalCount(signals);
    const urgentRequests = urgentRequestCount(requests);

    return [
      {
        category: "Shelter ops",
        amount: zones.length * 45000 + shelterPressure * 85000,
        driver: `${zones.length} live shelters, ${shelterPressure} under pressure`
      },
      {
        category: "Medical aid",
        amount: medicalSignals * 95000 + stressedResources * 40000,
        driver: `${medicalSignals} medical SOS, ${stressedResources} stressed stock lines`
      },
      {
        category: "Food & water",
        amount: urgentRequests * 65000 + stats.totalSafeZones * 18000,
        driver: `${urgentRequests} urgent resource requests`
      },
      {
        category: "Rescue logistics",
        amount: stats.pendingSOS * 70000 + stats.activeDisasters * 50000,
        driver: `${stats.pendingSOS} active SOS, ${stats.activeDisasters} live incidents`
      }
    ];
  }, [requests, resources, signals, stats.activeDisasters, stats.pendingSOS, stats.totalSafeZones, zones]);

  const projectedTotal = useMemo(
    () => financeModel.reduce((sum, item) => sum + item.amount, 0),
    [financeModel]
  );

  const topPressureDrivers = useMemo(
    () =>
      [...financeModel]
        .sort((left, right) => right.amount - left.amount)
        .slice(0, 3),
    [financeModel]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          helper="Derived from live shelter, SOS, resource, and request pressure."
          label="Projected 24h allocation"
          value={`LKR ${currencyLabel(projectedTotal)}`}
        />
        <StatCard
          helper="Resource lines flagged low or depleted in current inventory."
          label="Critical stock lines"
          value={resourceStressCount(resources)}
        />
        <StatCard
          helper="Shelters above 80% occupancy that need additional support."
          label="Shelter pressure sites"
          value={occupancyPressureCount(zones)}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/95 to-transparent">
          <CardTitle>Operational allocation model</CardTitle>
          <CardDescription className="mt-2">
            Command-side funding model generated from live pressure in shelters, SOS load, and resource demand.
          </CardDescription>
          <div className="mt-6 h-[360px]">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={financeModel}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                <XAxis dataKey="category" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 16,
                    color: "#e2e8f0"
                  }}
                  formatter={(value: number) => [`LKR ${currencyLabel(value)}`, "Projected allocation"]}
                />
                <Bar dataKey="amount" fill="#38bdf8" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(234,179,8,0.14),transparent_36%),linear-gradient(180deg,rgba(12,20,36,0.96),rgba(7,12,24,0.95))]">
            <CardTitle>Primary cost drivers</CardTitle>
            <CardDescription className="mt-2">Highest pressure categories in the current operating window.</CardDescription>
            <div className="mt-6 space-y-3">
              {topPressureDrivers.map((driver) => (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4" key={driver.category}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{driver.category}</p>
                      <p className="mt-1 text-sm text-slate-300">{driver.driver}</p>
                    </div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-100">
                      LKR {currencyLabel(driver.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_36%),linear-gradient(180deg,rgba(12,20,36,0.96),rgba(7,12,24,0.95))]">
            <CardTitle>Command notes</CardTitle>
            <CardDescription className="mt-2">Current allocation signals derived from live backend records.</CardDescription>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Pending SOS load is driving rescue logistics and medical allocation first.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Shelter occupancy pressure increases projected shelter operations spend.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Urgent request traffic is pushing food, water, and essentials allocation upward.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
