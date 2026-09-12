"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapView, markersFromPoints } from "@/components/map/map-view";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { hazardRequest } from "@/lib/hazards/client";
import type { GeoPoint, HazardRole, HazardSnapshot, SafeRoute } from "@/lib/hazards/types";
import type { MapMarker } from "@/lib/types";

export function hazardCircle(point: GeoPoint, radiusM: number) {
  const ring = Array.from({ length: 49 }, (_, index) => {
    const angle = index * Math.PI * 2 / 48;
    return [point.longitude + Math.cos(angle) * radiusM / (111320 * Math.max(0.01, Math.cos(point.latitude * Math.PI / 180))), point.latitude + Math.sin(angle) * radiusM / 111320];
  });
  return JSON.stringify({ type: "Polygon", coordinates: [ring] });
}

export function HazardMap({ snapshot, point, role = "citizen", extraMarkers = [], extraPolygons = [], center, onLocate, locationError, locating = false }: {
  snapshot: HazardSnapshot; point?: GeoPoint | null; role?: HazardRole; extraMarkers?: MapMarker[]; extraPolygons?: string[];
  center?: [number, number]; onLocate?: () => void; locationError?: string | null; locating?: boolean;
}) {
  const [route, setRoute] = useState<SafeRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hazardKey = snapshot.hazards.map((hazard) => `${hazard.id}:${hazard.updatedAt}`).sort().join("|");
  const shelterKey = snapshot.shelters.map((shelter) => `${shelter.id}:${shelter.available}`).sort().join("|");
  const weatherKey = JSON.stringify(snapshot.weather.map((reading) => [reading.id, reading.stationId, reading.location.latitude, reading.location.longitude, reading.observedAt, reading.receivedAt, reading.rainfallMm, reading.waterLevelM, reading.dangerLevelM]).sort());
  const warningKey = JSON.stringify(snapshot.alerts.filter((alert) => alert.kind === "weather_warning").map((alert) => [alert.id, alert.caseId, alert.location.latitude, alert.location.longitude, alert.radiusM, alert.createdAt, alert.expiresAt]).sort());
  const legacyAreasKey = JSON.stringify(extraPolygons);
  const contextKey = `${hazardKey}/${shelterKey}/${weatherKey}/${warningKey}/${legacyAreasKey}/${point?.latitude}/${point?.longitude}`;
  const currentContext = useRef(contextKey);
  currentContext.current = contextKey;
  // Pending weather warnings and legacy disaster areas also affect screening.
  // Clear a completed route and discard an in-flight result when any input changes.
  useEffect(() => { setRoute(null); }, [contextKey]);
  const markers = useMemo<MapMarker[]>(() => [
    ...extraMarkers,
    ...snapshot.hazards.map((hazard) => ({ id: hazard.id, label: `${hazard.title} — ${hazard.status}`, ...hazard.location, color: "#ef4444" })),
    ...markersFromPoints(snapshot.shelters.map((shelter) => ({ id: shelter.id, name: `${shelter.name} (${shelter.available} places available${shelter.fixture ? ", demo" : ""})`, location: JSON.stringify({ type: "Point", coordinates: [shelter.location.longitude, shelter.location.latitude] }), color: "#22c55e" }))),
    ...(point ? [{ id: "current-location", label: "Your current location", ...point, color: "#38bdf8" }] : [])
  ], [snapshot.hazards, snapshot.shelters, extraMarkers, point]);
  const polygons = useMemo(() => [...extraPolygons, ...snapshot.hazards.map((hazard) => hazardCircle(hazard.location, hazard.radiusM))], [snapshot.hazards, extraPolygons]);
  const mapCenter: [number, number] = center ?? (point ? [point.longitude, point.latitude] : snapshot.hazards[0] ? [snapshot.hazards[0].location.longitude, snapshot.hazards[0].location.latitude] : [79.8612, 6.9271]);

  async function screenRoute() {
    if (!point) return;
    const requestedContext = currentContext.current;
    setRouting(true); setError(null); setRoute(null);
    try {
      const screened = await hazardRequest<SafeRoute>("route", { location: point }, role);
      if (currentContext.current === requestedContext) setRoute(screened);
      else setError("Location or hazard information changed during the route check. Check the route again.");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to check a route. Please try again."); }
    finally { setRouting(false); }
  }

  return <Card>
    <CardTitle>Hazards, shelters and route checks</CardTitle>
    <CardDescription className="mt-2">Confirmed hazards appear in red; shelters in green; supplies in amber. Hazard boundaries are reported risk areas.</CardDescription>
    {snapshot.fixtureShelters ? <p className="mt-2 text-xs text-amber-300">Shelters shown for this local demonstration are sample locations.</p> : null}
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <MapView center={mapCenter} markers={markers} polygons={polygons} route={route?.status === "available" ? route.coordinates : []} className="max-h-[32rem]" />
      <div className="space-y-4">
        <p className="text-sm font-medium">{snapshot.hazards.length} active verified hazard{snapshot.hazards.length === 1 ? "" : "s"}</p>
        {onLocate ? <Button variant="outline" onClick={onLocate} disabled={locating}>{locating ? "Capturing GPS…" : "Use my location"}</Button> : null}
        {locationError ? <p className="text-sm text-red-300" role="alert">{locationError}</p> : null}
        {point ? <p className="text-xs text-muted">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p> : <p className="text-sm text-muted">Capture your location to filter area alerts and check a shelter route.</p>}
        <Button onClick={screenRoute} disabled={!point || routing}>{routing ? "Screening route…" : "Check route to a shelter"}</Button>
        {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
        {route ? <div className="space-y-2 rounded-xl border border-slate-700 p-3" role="status">
          <p className={`font-medium ${route.status === "available" ? "text-sky-300" : "text-amber-300"}`}>{route.status === "available" ? "Route screened against known hazards" : "No screened route available"}</p>
          <p className="text-sm">{route.reason}</p>
          {route.shelter ? <p className="text-sm">Destination: {route.shelter.name}</p> : null}
          {route.distanceM !== undefined ? <p className="text-xs text-muted">{(route.distanceM / 1000).toFixed(1)} km · Checked {new Date(route.checkedAt).toLocaleTimeString()}</p> : null}
          {route.limitations.map((limitation) => <p className="text-xs text-amber-200" key={limitation}>{limitation}</p>)}
        </div> : null}
        <p className="text-xs text-muted">Route screening uses known reports and available roads. Follow current instructions from local responders.</p>
      </div>
    </div>
    <div className="mt-5 border-t border-slate-800 pt-4">
      <h4 className="font-medium">{point ? "Alerts for your area" : "Area broadcasts"}</h4>
      {!point ? <p className="mt-1 text-xs text-muted">{role === "citizen" ? "Showing updates for your own reports. Share your location to receive nearby area alerts." : "Showing broadcasts across all areas."}</p> : null}
      <div className="mt-3 space-y-3" aria-live="polite">
        {snapshot.alerts.slice(0, 8).map((alert) => <div key={alert.id} className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
          <p className="text-sm font-medium">{alert.title}</p><p className="mt-1 text-sm text-muted">{alert.message}</p>
          <p className="mt-2 text-xs text-muted">{new Date(alert.createdAt).toLocaleString()} · {alert.radiusM / 1000} km around {alert.location.latitude.toFixed(3)}, {alert.location.longitude.toFixed(3)}</p>
        </div>)}
        {!snapshot.alerts.length ? <p className="text-sm text-muted">No current area alerts.</p> : null}
      </div>
    </div>
  </Card>;
}
