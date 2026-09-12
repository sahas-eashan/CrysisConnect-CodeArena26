"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { GeoPoint, PhotoInput } from "@/lib/hazards/types";
import { PhotoField } from "./photo-field";
import type { RunHazardAction } from "./use-hazards";

export const fieldClass = "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400";

export function ReportForm({ run, busy, onLocation }: { run: RunHazardAction; busy: boolean; onLocation: (point: GeoPoint) => void }) {
  const { coordinates, error: gpsError, loading: gpsLoading, requestLocation } = useGeolocation();
  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { if (coordinates) onLocation(coordinates); }, [coordinates, onLocation]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const form = new FormData(event.currentTarget);
    if (!coordinates || !photo) { setError("Capture your location and add a photo before reporting."); return; }
    const locality = String(form.get("locality") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (title.length < 5 || description.length < 10) { setError("Enter a title of at least 5 characters and a description of at least 10 characters."); return; }
    onLocation(coordinates);
    const saved = await run("report", { title, description: `${description}${locality ? `\nLocal landmark: ${locality}` : ""}`, kind: form.get("kind"), location: coordinates, photo, helpRequested: help, needs: String(form.get("needs") ?? "").trim() }, "Report saved. Follow its verification and responder updates below.");
    if (saved) { setPhoto(null); setHelp(false); setFormKey((key) => key + 1); }
  }
  return <Card>
    <CardTitle>Report a hazard or ask for help</CardTitle>
    <CardDescription className="mt-2">Share what you can observe from your current location. Your photo and GPS become evidence for verification.</CardDescription>
    <p className="mt-2 text-xs text-muted">Your GPS is matched to configured ward boundaries and nearby roads to identify the responsible council. Add a landmark if it helps responders find the location.</p>
    <form className="mt-5 space-y-4" key={formKey} onSubmit={submit}>
      <fieldset className="space-y-4" disabled={busy}>
        <label className="block space-y-2 text-sm">Hazard type<select className={fieldClass} name="kind" defaultValue="flood"><option value="flood">Flood</option><option value="landslide">Landslide</option><option value="storm">Storm</option><option value="tsunami">Tsunami</option><option value="fire">Fire</option><option value="blocked_road">Blocked road</option><option value="fallen_tree">Fallen tree</option><option value="other">Other</option></select></label>
        <label className="block space-y-2 text-sm">Title<Input name="title" placeholder="Floodwater across the main road" required minLength={5} maxLength={160} /></label>
        <label className="block space-y-2 text-sm">Ward or locality (optional landmark)<Input name="locality" placeholder="Nearby landmark or local name" maxLength={120} /></label>
        <label className="block space-y-2 text-sm">What is happening?<textarea className={fieldClass} name="description" rows={3} required minLength={10} maxLength={1800} /></label>
        <div className="space-y-2">
          <Button onClick={requestLocation} disabled={gpsLoading} variant="outline">{gpsLoading ? "Capturing GPS…" : "Capture my location"}</Button>
          {coordinates ? <p className="text-sm text-sky-300">GPS: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</p> : null}
          {gpsError ? <p className="text-sm text-red-300" role="alert">{gpsError}</p> : null}
        </div>
        <PhotoField value={photo} onChange={setPhoto} />
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={help} onChange={(event) => setHelp(event.target.checked)} />I need help or relief supplies</label>
        {help ? <label className="block space-y-2 text-sm">People affected and assistance needed<textarea className={fieldClass} name="needs" rows={2} required minLength={5} maxLength={1000} placeholder="4 people need shelter and drinking water" /></label> : null}
        <Button className="w-full" type="submit" disabled={busy || !photo || !coordinates}>{busy ? "Saving report…" : "Submit hazard report"}</Button>
      </fieldset>
      {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
    </form>
  </Card>;
}
