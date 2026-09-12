"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hazardCircle } from "@/components/hazards/hazard-map";
import { MapView } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { PublicHazardSnapshot } from "@/lib/hazards/types";
import type { MapMarker } from "@/lib/types";

export default function PublicMapPage() {
  const [snapshot, setSnapshot] = useState<PublicHazardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const response = await fetch("/api/hazards/public", { cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error("The public map could not be refreshed. Please try again.");
      const data: PublicHazardSnapshot = await response.json();
      if (request === latest.current) { setSnapshot(data); setError(null); }
    } catch (cause) { if (request === latest.current) setError(cause instanceof Error ? cause.message : "Unable to load public hazard updates."); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 10_000); return () => { ++latest.current; window.clearInterval(timer); }; }, [refresh]);
  const markers = useMemo<MapMarker[]>(() => [
    ...(snapshot?.hazards.map((hazard) => ({ id: hazard.id, label: hazard.title, ...hazard.location, color: "#ef4444" })) ?? []),
    ...(snapshot?.shelters.map((shelter) => ({ id: shelter.id, label: `${shelter.name}: ${shelter.available} places available${shelter.fixture ? " (demo)" : ""}`, ...shelter.location, color: "#22c55e" })) ?? [])
  ], [snapshot]);
  return <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <nav aria-label="Public map navigation" className="flex flex-wrap items-center gap-5 text-sm"><Link href="/" className="font-semibold text-sky-200">CrisisConnect</Link><Link href="/citizen/hazards" className="underline">Report a hazard or get personal alerts</Link></nav>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Public hazard map</h1><p className="mt-2 max-w-3xl text-sm text-muted">Current verified hazard areas, shelter availability and area warnings. No account is needed to view this map.</p></div><Button variant="outline" onClick={() => void refresh()}>Refresh map</Button></div>
    {error ? <p role="alert" className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-200">{error}{snapshot ? " Showing the last successful update; conditions may have changed." : ""}</p> : null}
    {!snapshot && !error ? <p role="status" className="text-sm text-muted">Loading the public map…</p> : null}
    {snapshot ? <>
      <Card><CardTitle>{snapshot.hazards.length} verified active hazard{snapshot.hazards.length === 1 ? "" : "s"}</CardTitle><CardDescription className="mt-2">Red areas show reported hazard boundaries. Green markers show shelters. Updated {new Date(snapshot.generatedAt).toLocaleString()}; refreshes every 10 seconds.</CardDescription>
        {snapshot.fixtureShelters ? <p className="mt-2 text-xs text-amber-200">Shelters in this demonstration are sample locations.</p> : null}
        <div className="mt-5"><MapView markers={markers} polygons={snapshot.hazards.map((hazard) => hazardCircle(hazard.location, hazard.radiusM))} className="max-h-[36rem]" /></div>
        {snapshot.hazards.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{snapshot.hazards.map((hazard) => <article key={hazard.id} className="rounded-xl border border-slate-700 p-3"><h3 className="text-sm font-medium">{hazard.title}</h3><p className="mt-1 text-xs text-muted">Urgency: {hazard.urgency ?? "unknown"}{hazard.ward ? ` · ${hazard.ward.name}` : ""}</p>{hazard.road ? <p className="mt-2 text-xs text-amber-200">{hazard.road.name}{hazard.road.closed ? " · Within hazard exclusion area" : " · Nearby road"}</p> : null}</article>)}</div> : null}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2"><Card><CardTitle>Area warnings and updates</CardTitle><div className="mt-4 space-y-3" aria-live="polite">{snapshot.alerts.map((alert) => <article className="rounded-xl border border-slate-700 p-4" key={alert.id}><h3 className="text-sm font-medium">{alert.title}</h3><p className="mt-2 text-sm text-muted">{alert.message}</p><p className="mt-2 text-xs text-muted">{new Date(alert.createdAt).toLocaleString()} · {alert.radiusM / 1000} km around {alert.location.latitude.toFixed(3)}, {alert.location.longitude.toFixed(3)}</p></article>)}{!snapshot.alerts.length ? <p className="text-sm text-muted">No current area warnings.</p> : null}</div></Card>
        <Card><CardTitle>Shelters</CardTitle><div className="mt-4 space-y-3">{snapshot.shelters.map((shelter) => <article className="rounded-xl border border-slate-700 p-4" key={shelter.id}><h3 className="text-sm font-medium">{shelter.name}</h3><p className="mt-2 text-sm text-sky-200">{shelter.available} of {shelter.capacity} places available</p>{shelter.fixture ? <p className="mt-1 text-xs text-amber-200">Demonstration shelter</p> : null}</article>)}{!snapshot.shelters.length ? <p className="text-sm text-muted">No shelters are currently listed.</p> : null}</div></Card></div>
      <p className="text-xs text-muted">Follow current instructions from local responders. Share your location in the citizen portal for nearby warnings and refreshed route guidance.</p>
    </> : null}
  </main>;
}
