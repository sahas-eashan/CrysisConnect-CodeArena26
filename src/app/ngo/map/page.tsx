"use client";

import { MapView, markersFromPoints } from "@/components/map/map-view";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mockResources, mockSOSSignals, mockSafeZones } from "@/lib/mock-data";

export default function NgoMapPage() {
  const markers = [
    ...markersFromPoints(mockSafeZones.map((zone) => ({ id: zone.id, name: zone.name, location: zone.location, color: "#22c55e" }))),
    ...markersFromPoints(mockResources.map((resource) => ({ id: resource.id, name: resource.name, location: resource.location, color: "#f59e0b" }))),
    ...markersFromPoints(mockSOSSignals.map((signal) => ({ id: signal.id, name: signal.type ?? "SOS", location: signal.location, color: "#ef4444" })))
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Operations map</CardTitle>
        <CardDescription className="mt-2">
          View shelters, depots, and live SOS markers while placing temporary checkpoints from the field.
        </CardDescription>
        <div className="mt-6">
          <MapView markers={markers} />
        </div>
      </Card>
    </div>
  );
}
