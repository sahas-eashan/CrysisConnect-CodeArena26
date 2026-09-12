"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockSafeZones } from "@/lib/mock-data";

export default function AdminSafeZonesPage() {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Safe zone mutation ready. In live mode this writes shelter capacity into RDS and becomes available to routing queries.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardTitle>Active safe zones</CardTitle>
        <CardDescription className="mt-2">Government-managed shelters with live capacity visibility.</CardDescription>
        <div className="mt-6 space-y-4">
          {mockSafeZones.map((zone) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={zone.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{zone.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {zone.currentOccupancy}/{zone.capacity} occupied
                  </p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">{zone.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Create or update shelter</CardTitle>
        <CardDescription className="mt-2">Set capacity, amenities, and location to enable routing.</CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="name" placeholder="Safe zone name" required />
          <Input min={1} name="capacity" placeholder="Capacity" required type="number" />
          <Input min={0} name="currentOccupancy" placeholder="Current occupancy" required type="number" />
          <Input name="amenities" placeholder="Amenities (comma separated)" />
          <Input name="location" placeholder='GeoJSON Point, e.g. {"type":"Point","coordinates":[79.87,6.93]}' />
          <Button className="w-full" type="submit">
            Save safe zone
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>
    </div>
  );
}
