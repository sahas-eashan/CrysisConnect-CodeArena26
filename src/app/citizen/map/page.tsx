"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MapView, markersFromPoints } from "@/components/map/map-view";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { parseGeoJsonPoint } from "@/lib/utils";
import { mockDisasters, mockResources, mockSafeZones } from "@/lib/mock-data";
import type { MapMarker } from "@/lib/types";

export default function CitizenMapPage() {
  const searchParams = useSearchParams();
  const selectedSafeZoneId = searchParams.get("safeZone");
  const [userLocation, setUserLocation] = useState<{ longitude: number; latitude: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude
        });
      },
      () => {
        setUserLocation(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }, []);

  const selectedSafeZone = useMemo(
    () => mockSafeZones.find((zone) => zone.id === selectedSafeZoneId) ?? mockSafeZones[0],
    [selectedSafeZoneId]
  );
  const selectedSafeZonePoint = parseGeoJsonPoint(selectedSafeZone?.location);
  const disasterCenterPoint = parseGeoJsonPoint(mockDisasters[0]?.centerPoint);
  const disasterPolygon = {
    type: "Polygon",
    coordinates: [[[79.851, 6.915], [79.891, 6.915], [79.891, 6.949], [79.851, 6.949], [79.851, 6.915]]]
  };
  const disasterInfoPoint = useMemo(() => {
    const ring = disasterPolygon.coordinates[0];
    const longitudes = ring.map(([longitude]) => longitude);
    const latitudes = ring.map(([, latitude]) => latitude);

    return {
      longitude: Math.max(...longitudes) - 0.0015,
      latitude: Math.max(...latitudes) - 0.001
    };
  }, []);

  const markers: MapMarker[] = [
    ...markersFromPoints(mockSafeZones.map((zone) => ({ id: zone.id, name: zone.name, location: zone.location, color: "#22c55e" }))),
    ...markersFromPoints(mockResources.map((resource) => ({ id: resource.id, name: resource.name, location: resource.location, color: "#f59e0b" }))),
    ...(userLocation
      ? [
          {
            id: "citizen-current-location",
            label: "Your current location",
            longitude: userLocation.longitude,
            latitude: userLocation.latitude,
            color: "#3b82f6",
            popup: '<div style="color:#f8fafc;font-weight:600;font-size:14px;line-height:1.3;">Your current location</div>'
          } satisfies MapMarker
        ]
      : []),
    ...(disasterInfoPoint
      ? [
          {
            id: `${mockDisasters[0].id}-info`,
            label: `${mockDisasters[0].title}`,
            longitude: disasterInfoPoint.longitude,
            latitude: disasterInfoPoint.latitude,
            popup: `<div style="color:#f8fafc;font-weight:600;font-size:14px;line-height:1.3;">${mockDisasters[0].title}</div>`,
            variant: "info"
          } satisfies MapMarker
        ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Live disaster map</CardTitle>
        <CardDescription className="mt-2">
          Red zones show affected areas, green markers show safe zones, and amber markers show resource depots.
        </CardDescription>
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,36rem)_18rem] lg:items-start lg:justify-center">
          <MapView
            className="mx-auto max-w-[36rem] lg:mx-0"
            center={
              selectedSafeZonePoint ? [selectedSafeZonePoint.longitude, selectedSafeZonePoint.latitude] : undefined
            }
            markers={markers}
            polygons={[JSON.stringify(disasterPolygon)]}
          />
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-sm font-semibold text-white">Map legend</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <span>Resources</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                <span>Shelters</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                <span>You</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm bg-red-500/80" />
                <span>Disaster zone</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Affected zone</CardTitle>
          <CardDescription className="mt-2">{mockDisasters[0].title}</CardDescription>
        </Card>
        <Card>
          <CardTitle>Recommended shelter</CardTitle>
          <CardDescription className="mt-2">{selectedSafeZone?.name}</CardDescription>
        </Card>
        <Card>
          <CardTitle>Nearest water supply</CardTitle>
          <CardDescription className="mt-2">{mockResources[0].name}</CardDescription>
        </Card>
      </div>
    </div>
  );
}
