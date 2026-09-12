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
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,36rem)_18rem] lg:items-start lg:justify-center">
          <MapView className="mx-auto max-w-[36rem] lg:mx-0" markers={markers} />
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
                <span className="h-3 w-3 rounded-full bg-red-500" />
                <span>SOS signals</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
