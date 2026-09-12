"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { MapView, markersFromPoints } from "@/components/map/map-view";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { parseGeoJsonPoint } from "@/lib/utils";
import { mockDisasters, mockResources, mockSafeZones } from "@/lib/mock-data";

export default function CitizenMapPage() {
  const searchParams = useSearchParams();
  const selectedSafeZoneId = searchParams.get("safeZone");
  const selectedSafeZone = useMemo(
    () => mockSafeZones.find((zone) => zone.id === selectedSafeZoneId) ?? mockSafeZones[0],
    [selectedSafeZoneId]
  );
  const selectedSafeZonePoint = parseGeoJsonPoint(selectedSafeZone?.location);

  const markers = [
    ...markersFromPoints(mockSafeZones.map((zone) => ({ id: zone.id, name: zone.name, location: zone.location, color: "#22c55e" }))),
    ...markersFromPoints(mockResources.map((resource) => ({ id: resource.id, name: resource.name, location: resource.location, color: "#f59e0b" })))
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Live disaster map</CardTitle>
        <CardDescription className="mt-2">
          Red zones show affected areas, green markers show safe zones, and amber markers show resource depots.
        </CardDescription>
        <div className="mt-6">
          <MapView
            center={
              selectedSafeZonePoint ? [selectedSafeZonePoint.longitude, selectedSafeZonePoint.latitude] : undefined
            }
            markers={markers}
            polygons={[
              JSON.stringify({
                type: "Polygon",
                coordinates: [[[79.851, 6.915], [79.891, 6.915], [79.891, 6.949], [79.851, 6.949], [79.851, 6.915]]]
              })
            ]}
          />
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
