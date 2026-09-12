"use client";

import { FormEvent, useState } from "react";

import { MapDraw } from "@/components/map/map-draw";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockDisasters } from "@/lib/mock-data";

export default function AdminDisastersPage() {
  const [geometry, setGeometry] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      geometry
        ? "Disaster payload captured. In live mode this triggers createDisaster, stores the polygon in PostGIS, and dispatches geofenced alerts."
        : "Draw the affected polygon first so the alerting engine can geofence nearby citizens."
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardTitle>Register a disaster</CardTitle>
        <CardDescription className="mt-2">
          Draw the affected area polygon and publish a new incident to all portals.
        </CardDescription>
        <div className="mt-6">
          <MapDraw onGeometryChange={setGeometry} />
        </div>
      </Card>

      <Card>
        <CardTitle>Disaster details</CardTitle>
        <CardDescription className="mt-2">Form values map directly to the AppSync `createDisaster` mutation.</CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="title" placeholder="Incident title" required />
          <Input name="type" placeholder="Type (flood, landslide, earthquake...)" required />
          <select className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm" name="severity">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <textarea
            className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="description"
            placeholder="Operational description"
          />
          <Input name="secondaryRisks" placeholder="Secondary risks (comma separated)" />
          <Input name="affectedArea" placeholder="Drawn polygon GeoJSON" readOnly value={geometry} />
          <Button className="w-full" type="submit">
            Register disaster
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="font-medium text-white">Latest incident</p>
          <p className="mt-2 text-sm text-muted">{mockDisasters[0].title}</p>
        </div>
      </Card>
    </div>
  );
}
