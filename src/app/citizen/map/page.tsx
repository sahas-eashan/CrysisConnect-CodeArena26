"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { generateClient } from "aws-amplify/api";
import { HazardMap, hazardCircle } from "@/components/hazards/hazard-map";
import { useHazards } from "@/components/hazards/use-hazards";
import { MapView, markersFromPoints } from "@/components/map/map-view";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useGeolocation } from "@/hooks/use-geolocation";
import { configureAmplify } from "@/lib/aws/amplify";
import { queries } from "@/lib/aws/graphql/operations";
import type { Disaster, MapMarker, Resource, SafeZone } from "@/lib/types";
import { parseGeoJsonPoint } from "@/lib/utils";

function validPoint(value?: string | null) {
  const point = parseGeoJsonPoint(value);
  return point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 85 && Math.abs(point.longitude) <= 180 ? point : null;
}

function polygonFor(disaster: Disaster): string | null {
  if (disaster.affectedArea) {
    try {
      const parsed = JSON.parse(disaster.affectedArea);
      const geometry = parsed.type === "Feature" ? parsed.geometry : parsed;
      if (["Polygon", "MultiPolygon"].includes(geometry?.type) && Array.isArray(geometry.coordinates)) return JSON.stringify(geometry);
    } catch { /* Fall through to the actual configured radius. */ }
  }
  const point = validPoint(disaster.centerPoint);
  return point && disaster.radiusKm && disaster.radiusKm > 0 ? hazardCircle(point, disaster.radiusKm * 1000) : null;
}

function CitizenMapContent() {
  const selectedId = useSearchParams().get("safeZone");
  const hasAws = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [shelters, setShelters] = useState<SafeZone[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [awsError, setAwsError] = useState<string | null>(null);
  const [awsLoading, setAwsLoading] = useState(hasAws);
  const { coordinates, error: gpsError, loading: locating, requestLocation } = useGeolocation();
  const hazards = useHazards("citizen", coordinates);

  useEffect(() => {
    if (!hasAws) return;
    let active = true;
    let pending = false;
    configureAmplify(); const client = generateClient();
    async function refresh() {
      if (pending) return;
      pending = true;
      const results = await Promise.allSettled([
        client.graphql({ query: queries.getDisasters, authMode: "userPool" }),
        client.graphql({ query: queries.getSafeZones, authMode: "userPool" }),
        client.graphql({ query: queries.getResources, authMode: "userPool" })
      ]);
      if (active) {
        const errors: string[] = [];
        if (results[0].status === "fulfilled") setDisasters((results[0].value as { data?: { getDisasters?: Disaster[] } }).data?.getDisasters ?? []); else errors.push("disasters");
        if (results[1].status === "fulfilled") setShelters((results[1].value as { data?: { getSafeZones?: SafeZone[] } }).data?.getSafeZones ?? []); else errors.push("shelters");
        if (results[2].status === "fulfilled") setResources((results[2].value as { data?: { getResources?: Resource[] } }).data?.getResources ?? []); else errors.push("resources");
        setAwsError(errors.length ? `Unable to refresh ${errors.join(", ")}. Any existing markers show the last successful update; retrying shortly.` : null);
        setAwsLoading(false);
      }
      pending = false;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [hasAws]);

  const activeDisasters = useMemo(() => disasters.filter((disaster) => !["resolved", "closed", "inactive"].includes(disaster.status?.toLowerCase())), [disasters]);
  const openShelters = useMemo(() => shelters.filter((shelter) => !["closed", "inactive"].includes(shelter.status?.toLowerCase() ?? "")), [shelters]);
  const selectedShelter = selectedId ? openShelters.find((shelter) => shelter.id === selectedId) : undefined;
  const selectedHazardShelter = selectedId ? hazards.snapshot?.shelters.find((shelter) => shelter.id === selectedId) : undefined;
  const selectedPoint = validPoint(selectedShelter?.location) ?? selectedHazardShelter?.location;
  const disasterPoint = validPoint(activeDisasters[0]?.centerPoint);
  const center: [number, number] | undefined = selectedPoint ? [selectedPoint.longitude, selectedPoint.latitude] : coordinates ? [coordinates.longitude, coordinates.latitude] : disasterPoint ? [disasterPoint.longitude, disasterPoint.latitude] : undefined;
  const markers = useMemo<MapMarker[]>(() => [
    ...markersFromPoints(openShelters.filter((shelter) => validPoint(shelter.location)).map((shelter) => ({ id: shelter.id, name: `${shelter.name} (${Math.max(0, shelter.capacity - shelter.currentOccupancy)} places available)`, location: shelter.location, color: "#22c55e" }))),
    ...markersFromPoints(resources.filter((resource) => validPoint(resource.location) && !["depleted", "unavailable"].includes(resource.status?.toLowerCase() ?? "")).map((resource) => ({ id: resource.id, name: resource.name, location: resource.location, color: "#f59e0b" }))),
    ...markersFromPoints(activeDisasters.filter((disaster) => validPoint(disaster.centerPoint)).map((disaster) => ({ id: disaster.id, name: disaster.title, location: disaster.centerPoint, color: "#ef4444" })))
  ], [openShelters, resources, activeDisasters]);
  const polygons = activeDisasters.map(polygonFor).filter((polygon): polygon is string => Boolean(polygon));

  return <div className="space-y-6">
    <Card><CardTitle>Live disaster map</CardTitle><CardDescription className="mt-2">Disasters, shelters and resource depots refresh from the configured services every 10 seconds.</CardDescription>
      {!hasAws ? <p className="mt-3 text-sm text-amber-300">AWS disaster and resource services are not configured. The map displays the shared hazard workflow data available on this server.</p> : null}
      {awsLoading || hazards.loading ? <p className="mt-3 text-sm text-muted" role="status">Loading map data…</p> : null}
      {awsError ? <p className="mt-3 text-sm text-red-300" role="alert">{awsError}</p> : null}
      {hazards.error ? <p className="mt-3 text-sm text-red-300" role="alert">{hazards.error}</p> : null}
      {selectedId && !awsLoading && !hazards.loading && !selectedShelter && !selectedHazardShelter ? <p className="mt-3 text-sm text-amber-300">The requested shelter is unavailable or no longer listed. Select an available shelter before planning travel.</p> : null}
      {selectedShelter || selectedHazardShelter ? <p className="mt-3 text-sm text-sky-200">Selected shelter: {selectedShelter?.name ?? selectedHazardShelter?.name}</p> : null}
    </Card>
    {hazards.snapshot ? <HazardMap snapshot={hazards.snapshot} point={coordinates} extraMarkers={markers} extraPolygons={polygons} center={center} onLocate={requestLocation} locating={locating} locationError={gpsError} /> : <Card><MapView center={center} markers={markers} polygons={polygons} /><p className="mt-3 text-sm text-muted">Route screening is unavailable until the hazard service responds.</p></Card>}
  </div>;
}

export default function CitizenMapPage() {
  return <Suspense fallback={<Card><CardTitle>Live disaster map</CardTitle><CardDescription className="mt-2">Loading map context…</CardDescription></Card>}><CitizenMapContent /></Suspense>;
}
