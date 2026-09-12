"use client";

import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import type { Alert, DashboardStats, Disaster, ResourceRequest, SOSSignal } from "@/lib/types";

const emptyStats: DashboardStats = {
  activeDisasters: 0,
  pendingSOS: 0,
  totalResources: 0,
  totalSafeZones: 0,
  totalUsers: 0
};

type TrendPoint = {
  hour: string;
  sos: number;
  requests: number;
  alerts: number;
};

function hourlyBucketLabel(date: Date) {
  return `${date.getHours().toString().padStart(2, "0")}:00`;
}

function buildTrendPoints(signals: SOSSignal[], requests: ResourceRequest[], alerts: Alert[]) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const bucketStart = new Date(now);
    bucketStart.setMinutes(0, 0, 0);
    bucketStart.setHours(now.getHours() - (5 - index));
    return {
      key: bucketStart.toISOString(),
      hour: hourlyBucketLabel(bucketStart),
      start: bucketStart.getTime(),
      end: bucketStart.getTime() + 60 * 60 * 1000,
      sos: 0,
      requests: 0,
      alerts: 0
    };
  });

  const assign = (createdAt: string | null | undefined, field: "sos" | "requests" | "alerts") => {
    if (!createdAt) return;
    const time = new Date(createdAt).getTime();
    const bucket = buckets.find((item) => time >= item.start && time < item.end);
    if (bucket) {
      bucket[field] += 1;
    }
  };

  signals.forEach((signal) => assign(signal.createdAt, "sos"));
  requests.forEach((request) => assign(request.createdAt, "requests"));
  alerts.forEach((alert) => assign(alert.createdAt, "alerts"));

  return buckets.map(({ hour, sos, requests, alerts }) => ({
    hour,
    sos,
    requests,
    alerts
  }));
}

function buildSeverityMix(disasters: Disaster[]) {
  const severityCount = new Map<string, number>();
  disasters.forEach((disaster) => {
    const key = (disaster.severity ?? "unknown").toLowerCase();
    severityCount.set(key, (severityCount.get(key) ?? 0) + 1);
  });

  return Array.from(severityCount.entries()).map(([severity, count]) => ({
    severity,
    count
  }));
}

export default function AdminAnalyticsPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [signals, setSignals] = useState<SOSSignal[]>([]);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadAnalytics() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);

        const [statsResult, sosResult, requestsResult, alertsResult, disastersResult] = await Promise.allSettled([
          client.graphql({
            query: queries.getDashboardStats,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getSOSSignals,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getResourceRequests,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getAlerts,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getDisasters,
            authMode: "userPool"
          })
        ]);

        if (!active) return;

        setStats(statsResult.status === "fulfilled" ? (((statsResult.value as any).data?.getDashboardStats ?? emptyStats) as DashboardStats) : emptyStats);
        setSignals(sosResult.status === "fulfilled" ? (((sosResult.value as any).data?.getSOSSignals ?? []) as SOSSignal[]) : []);
        setRequests(requestsResult.status === "fulfilled" ? (((requestsResult.value as any).data?.getResourceRequests ?? []) as ResourceRequest[]) : []);
        setAlerts(alertsResult.status === "fulfilled" ? (((alertsResult.value as any).data?.getAlerts ?? []) as Alert[]) : []);
        setDisasters(disastersResult.status === "fulfilled" ? (((disastersResult.value as any).data?.getDisasters ?? []) as Disaster[]) : []);

        const loadErrors = [
          statsResult.status === "rejected" ? statsResult.reason : null,
          sosResult.status === "rejected" ? sosResult.reason : null,
          requestsResult.status === "rejected" ? requestsResult.reason : null,
          alertsResult.status === "rejected" ? alertsResult.reason : null,
          disastersResult.status === "rejected" ? disastersResult.reason : null
        ]
          .map((item) => (item instanceof Error ? item.message : null))
          .filter((message): message is string => Boolean(message));

        setError(loadErrors[0] ?? null);
      } catch (loadError) {
        if (!active) return;

        setStats(emptyStats);
        setSignals([]);
        setRequests([]);
        setAlerts([]);
        setDisasters([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load command analytics.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  const trendData = useMemo(
    () => buildTrendPoints(signals, requests, alerts),
    [alerts, requests, signals]
  );

  const severityMix = useMemo(
    () => buildSeverityMix(disasters),
    [disasters]
  );

  const peakHour = useMemo(
    () =>
      [...trendData].sort(
        (left, right) =>
          right.sos + right.requests + right.alerts - (left.sos + left.requests + left.alerts)
      )[0],
    [trendData]
  );

  const unresolvedSignals = useMemo(
    () =>
      signals.filter((signal) => {
        const status = (signal.status ?? "pending").toLowerCase();
        return status !== "resolved";
      }).length,
    [signals]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          helper="Highest combined alert, SOS, and request activity in the last six hourly buckets."
          label="Peak command hour"
          value={peakHour?.hour ?? "--:--"}
        />
        <StatCard
          helper="Signals still open across pending, assigned, and in-progress states."
          label="Unresolved SOS"
          value={unresolvedSignals}
        />
        <StatCard
          helper="Alert records currently available to the government role."
          label="Alert records"
          value={alerts.length}
        />
        <StatCard
          helper="Live incident count currently visible in the disaster registry."
          label="Active incidents"
          value={stats.activeDisasters}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-slate-950/95 to-transparent">
          <CardTitle>Operational trendline</CardTitle>
          <CardDescription className="mt-2">
            Recent command activity across SOS intake, citizen requests, and published alerts.
          </CardDescription>
          <div className="mt-6 h-[360px]">
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={trendData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                <XAxis dataKey="hour" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: 16,
                    color: "#e2e8f0"
                  }}
                />
                <Area dataKey="sos" fill="#ef4444" fillOpacity={0.22} stroke="#ef4444" type="monotone" />
                <Area dataKey="requests" fill="#f59e0b" fillOpacity={0.18} stroke="#f59e0b" type="monotone" />
                <Area dataKey="alerts" fill="#38bdf8" fillOpacity={0.18} stroke="#38bdf8" type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-red-400/20 bg-gradient-to-br from-red-500/10 via-slate-950/95 to-transparent">
            <CardTitle>Incident severity mix</CardTitle>
            <CardDescription className="mt-2">Current disaster composition by severity level.</CardDescription>
            <div className="mt-6 h-[240px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={severityMix}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                  <XAxis dataKey="severity" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: 16,
                      color: "#e2e8f0"
                    }}
                  />
                  <Bar dataKey="count" fill="#38bdf8" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_36%),linear-gradient(180deg,rgba(12,20,36,0.96),rgba(7,12,24,0.95))]">
            <CardTitle>Command highlights</CardTitle>
            <CardDescription className="mt-2">Signals worth attention in the current analytics window.</CardDescription>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                SOS activity peaked at {peakHour?.hour ?? "--:--"} in the current rolling window.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                {requests.length} live resource requests are contributing to command traffic.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                {alerts.length} alert records are available for post-broadcast review.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
