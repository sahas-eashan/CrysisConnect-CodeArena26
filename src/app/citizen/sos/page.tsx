"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";
import { mockSOSSignals } from "@/lib/mock-data";

export default function CitizenSOSPage() {
  const [message, setMessage] = useState<string | null>(null);
  const { coordinates, error, loading, requestLocation } = useGeolocation();

  const geoJson = useMemo(() => {
    if (!coordinates) return null;
    return JSON.stringify({
      type: "Point",
      coordinates: [coordinates.longitude, coordinates.latitude]
    });
  }, [coordinates]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      geoJson
        ? `SOS ready for AppSync mutation with location ${geoJson}. Nearest responders will be notified immediately.`
        : "Capture your location first so the system can route the SOS to the closest responders."
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <Card className="border-danger/30">
        <CardTitle>Emergency SOS</CardTitle>
        <CardDescription className="mt-2">
          One tap to alert nearby responders. Your live coordinates are used for triage and safe-zone routing.
        </CardDescription>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={requestLocation} variant="danger">
            {loading ? "Capturing location..." : "Capture my location"}
          </Button>
          {coordinates ? (
            <span className="rounded-full bg-success/15 px-3 py-2 text-sm text-green-300">
              {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <select className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm" name="type">
            <option value="medical">Medical emergency</option>
            <option value="trapped">Trapped or stranded</option>
            <option value="evacuation">Evacuation needed</option>
            <option value="resources">Urgent essentials needed</option>
          </select>
          <Input name="description" placeholder="Describe the situation" />
          <Button className="w-full" type="submit" variant="danger">
            Send SOS
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
      </Card>

      <Card>
        <CardTitle>Live response status</CardTitle>
        <CardDescription className="mt-2">Track responder assignment and rescue progress in real time.</CardDescription>
        <div className="mt-6 space-y-3">
          {mockSOSSignals.map((signal) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={signal.id}>
              <p className="font-medium text-white">{signal.type}</p>
              <p className="mt-1 text-sm text-muted">{signal.description}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-primary">Status: {signal.status}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
