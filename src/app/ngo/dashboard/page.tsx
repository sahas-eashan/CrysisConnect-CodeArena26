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
  const [loading, setLoading] = useState(hasAwsConfig);
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
        setLoading(true);

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
      } finally {
        if (active) {
          setLoading(false);
        }
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
          <StatCard
            helper="Currently active incidents"
            label="Active disasters"
            loading={loading}
            value={state.activeDisasters.length}
          />
        </Link>
        <Link href="/ngo/resources">
          <StatCard
            helper="Published inventory items"
            label="Tracked resources"
            loading={loading}
            value={state.resources.length}
          />
        </Link>
        <Link href="/ngo/requests">
          <StatCard
            helper="Requests from citizens"
            label="Pending resource requests"
            loading={loading}
            value={state.pendingRequests.length}
          />
        </Link>
        <Link href="/ngo/sos-queue">
          <StatCard helper="Needs rapid triage" label="Open SOS queue" loading={loading} value={state.sosSignals.length} />
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <CardTitle>Today&apos;s operational focus</CardTitle>
          <CardDescription className="mt-2">
            Coordinate field workers around the highest-impact incident zones.
          </CardDescription>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {state.activeDisasters.length ? (
            state.activeDisasters.map((disaster) => (
              <Link href="/ngo/map" key={disaster.id}>
                <Card className="h-full transition hover:border-primary/60 hover:bg-slate-950/70">
                  <p className="font-medium text-white">{disaster.title}</p>
                  <p className="mt-2 text-sm text-muted">
                    {disaster.description ?? "No disaster summary was returned from the backend."}
                  </p>
                  <p className="mt-4 text-xs text-primary">Open on operations map</p>
                </Card>
              </Link>
            ))
          ) : (
            <Card>
              <p className="font-medium text-white">No active disaster available</p>
              <p className="mt-2 text-sm text-muted">
                The backend did not return any active disasters for today&apos;s operational focus.
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
