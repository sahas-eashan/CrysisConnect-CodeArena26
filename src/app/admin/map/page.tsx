"use client";

import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { MapView, markersFromPoints } from "@/components/map/map-view";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import type { Disaster, MapMarker, Resource, SOSSignal, SafeZone } from "@/lib/types";

function parsePolygon(polygon?: string | null) {
  if (!polygon) return null;

  try {
    const parsed = JSON.parse(polygon) as {
      coordinates?: unknown;
      type?: string;
    };

    if (parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates) || !parsed.coordinates.length) return null;

    const firstRing = parsed.coordinates[0];
    if (!Array.isArray(firstRing)) return null;

    const coordinates = firstRing
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const longitude = Number(point[0]);
        const latitude = Number(point[1]);
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
        return [longitude, latitude] as [number, number];
      })
      .filter((point): point is [number, number] => Boolean(point));

    return coordinates.length ? coordinates : null;
  } catch {
    return null;
  }
}

export default function AdminMapPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [sosSignals, setSosSignals] = useState<SOSSignal[]>([]);
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadMapData() {
      configureAmplify();
      const client = generateClient();

      try {
        setError(null);
        const [safeZonesResult, resourcesResult, sosResult, disastersResult] = await Promise.allSettled([
          client.graphql({
            query: queries.getSafeZones,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getResources,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getSOSSignals,
            authMode: "userPool"
          }),
          client.graphql({
            query: queries.getDisasters,
            authMode: "userPool",
            variables: { status: "active" }
          })
        ]);

        if (!active) return;

        setSafeZones(safeZonesResult.status === "fulfilled" ? (((safeZonesResult.value as any).data?.getSafeZones ?? []) as SafeZone[]) : []);
        setResources(resourcesResult.status === "fulfilled" ? (((resourcesResult.value as any).data?.getResources ?? []) as Resource[]) : []);
        setSosSignals(sosResult.status === "fulfilled" ? (((sosResult.value as any).data?.getSOSSignals ?? []) as SOSSignal[]) : []);
        setDisasters(disastersResult.status === "fulfilled" ? (((disastersResult.value as any).data?.getDisasters ?? []) as Disaster[]) : []);

        const loadErrors = [
          safeZonesResult.status === "rejected" ? safeZonesResult.reason : null,
          resourcesResult.status === "rejected" ? resourcesResult.reason : null,
          sosResult.status === "rejected" ? sosResult.reason : null,
          disastersResult.status === "rejected" ? disastersResult.reason : null
        ]
          .map((item) => (item instanceof Error ? item.message : null))
          .filter((message): message is string => Boolean(message));

        setError(loadErrors[0] ?? null);
      } catch (loadError) {
        if (!active) return;

        setSafeZones([]);
        setResources([]);
        setSosSignals([]);
        setDisasters([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load command map data.");
      }
    }

    void loadMapData();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  const disasterInfoMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];

    disasters.forEach((disaster) => {
      const ring = parsePolygon(disaster.affectedArea);
      if (!ring) return;

      const longitudes = ring.map(([longitude]) => longitude);
      const latitudes = ring.map(([, latitude]) => latitude);

      markers.push({
        id: `${disaster.id}-info`,
        label: disaster.title,
        longitude: Math.max(...longitudes) - 0.0015,
        latitude: Math.max(...latitudes) - 0.001,
        popup: `<div style="color:#f8fafc;font-weight:600;font-size:14px;line-height:1.3;">${disaster.title}</div>`,
        variant: "info"
      });
    });

    return markers;
  }, [disasters]);

  const markers: MapMarker[] = [
    ...markersFromPoints(safeZones.map((zone) => ({ id: zone.id, name: zone.name, location: zone.location, color: "#22c55e" }))),
    ...markersFromPoints(resources.map((resource) => ({ id: resource.id, name: resource.name, location: resource.location, color: "#f59e0b" }))),
    ...markersFromPoints(sosSignals.map((signal) => ({ id: signal.id, name: signal.type ?? "SOS", location: signal.location, color: "#ef4444" }))),
    ...disasterInfoMarkers
  ];
  const polygons = disasters
    .map((disaster) => disaster.affectedArea)
    .filter((affectedArea): affectedArea is string => Boolean(affectedArea));

  return (
    <div className="space-y-6">
      <Card className="border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-slate-950/95 to-transparent">
        <CardTitle>Government command map</CardTitle>
        <CardDescription className="mt-2">
          View shelters, inventory, SOS markers, and active disaster zones from the command center.
        </CardDescription>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,38rem)_20rem] lg:items-start lg:justify-center">
          <MapView className="mx-auto max-w-[38rem] lg:mx-0" markers={markers} polygons={polygons} />
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-semibold text-white">Map legend</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <span>Resources</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Safe zones</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-red-500" />
                  <span>SOS signals</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-sm bg-red-500/80" />
                  <span>Disaster zones</span>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm font-semibold text-white">Live counts</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Open SOS</span>
                  <span>{sosSignals.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Safe zones</span>
                  <span>{safeZones.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Resources</span>
                  <span>{resources.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Active disasters</span>
                  <span>{disasters.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
