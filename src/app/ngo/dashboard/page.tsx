"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import { mockDisasters, mockResourceRequests, mockResources, mockSOSSignals } from "@/lib/mock-data";
import type { Disaster, Resource, ResourceRequest, SOSSignal } from "@/lib/types";

type DashboardState = {
  activeDisasters: Disaster[];
  disaster: Disaster | null;
  pendingRequests: ResourceRequest[];
  resources: Resource[];
  sosSignals: SOSSignal[];
};

export default function NgoDashboardPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [state, setState] = useState<DashboardState>(() => ({
    activeDisasters: hasAwsConfig ? [] : mockDisasters,
    disaster: hasAwsConfig ? null : mockDisasters[0] ?? null,
    pendingRequests: hasAwsConfig ? [] : mockResourceRequests,
    resources: hasAwsConfig ? [] : mockResources,
    sosSignals: hasAwsConfig ? [] : mockSOSSignals.filter((signal) => (signal.status ?? "").toLowerCase() === "pending")
  }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) return;

    let active = true;

    async function loadDashboard() {
      configureAmplify();
      const client = generateClient();

      try {
        setError(null);

        const [disastersResult, resourcesResult, requestsResult, sosResult] = await Promise.allSettled([
          client.graphql({
            query: queries.getDisasters,
            authMode: "userPool",
            variables: { status: "active" }
          }),
          client.graphql({
            query: queries.getResources,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getResourceRequests,
            authMode: "userPool",
            variables: { status: "pending" }
          }),
          client.graphql({
            query: queries.getSOSSignals,
            authMode: "userPool",
            variables: { status: "pending" }
          })
        ]);

        if (!active) return;

        const disasters =
          disastersResult.status === "fulfilled"
            ? (((disastersResult.value as any).data?.getDisasters ?? []) as Disaster[])
            : [];
        const resources =
          resourcesResult.status === "fulfilled"
            ? (((resourcesResult.value as any).data?.getResources ?? []) as Resource[])
            : [];
        const pendingRequests =
          requestsResult.status === "fulfilled"
            ? (((requestsResult.value as any).data?.getResourceRequests ?? []) as ResourceRequest[])
            : [];
        const sosSignals =
          sosResult.status === "fulfilled"
            ? (((sosResult.value as any).data?.getSOSSignals ?? []) as SOSSignal[])
            : [];

        setState({
          activeDisasters: disasters,
          disaster: disasters[0] ?? null,
          pendingRequests,
          resources,
          sosSignals
        });

        const errors = [
          disastersResult.status === "rejected"
            ? disastersResult.reason instanceof Error
              ? disastersResult.reason.message
              : "Unable to load active disaster data."
            : null,
          resourcesResult.status === "rejected"
            ? resourcesResult.reason instanceof Error
              ? resourcesResult.reason.message
              : "Unable to load resource inventory."
            : null,
          requestsResult.status === "rejected"
            ? requestsResult.reason instanceof Error
              ? requestsResult.reason.message
              : "Unable to load pending resource requests."
            : null,
          sosResult.status === "rejected"
            ? sosResult.reason instanceof Error
              ? sosResult.reason.message
              : "Unable to load the SOS queue."
            : null
        ].filter((message): message is string => Boolean(message));

        setError(errors[0] ?? null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load live NGO dashboard data.");
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/ngo/map">
          <StatCard helper="Currently active incidents" label="Active disasters" value={state.activeDisasters.length} />
        </Link>
        <Link href="/ngo/resources">
          <StatCard helper="Published inventory items" label="Tracked resources" value={state.resources.length} />
        </Link>
        <Link href="/ngo/resources">
          <StatCard
            helper="Requests from citizens"
            label="Pending resource requests"
            value={state.pendingRequests.length}
          />
        </Link>
        <Link href="/ngo/sos-queue">
          <StatCard helper="Needs rapid triage" label="Open SOS queue" value={state.sosSignals.length} />
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <Link href="/ngo/map">
        <Card className="transition hover:border-primary/60 hover:bg-slate-950/70">
          <CardTitle>Today&apos;s operational focus</CardTitle>
          <CardDescription className="mt-2">
            Coordinate field workers around the highest-impact incident zone.
          </CardDescription>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="font-medium text-white">{state.disaster?.title ?? "No active disaster available"}</p>
            <p className="mt-2 text-sm text-muted">
              {state.disaster?.description ?? "The backend did not return an active disaster summary."}
            </p>
            <p className="mt-4 text-xs text-primary">Open on operations map</p>
          </div>
        </Card>
      </Link>
    </div>
  );
}
