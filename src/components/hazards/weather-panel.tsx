"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { HazardSnapshot } from "@/lib/hazards/types";
import { fieldClass } from "./report-form";
import type { RunHazardAction } from "./use-hazards";

export function WeatherPanel({ snapshot, run, busy }: { snapshot: HazardSnapshot; run: RunHazardAction; busy: boolean }) {
  const [scenario, setScenario] = useState("flood");
  return <Card>
    <CardTitle>Weather and river monitoring</CardTitle>
    <CardDescription className="mt-2">Rainfall and river thresholds raise area warnings and open cases for verification.</CardDescription>
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 p-3">
      <label className="flex-1 space-y-2 text-sm">Replay scenario<select className={fieldClass} value={scenario} onChange={(event) => setScenario(event.target.value)}><option value="flood">Rising water and heavy rain</option><option value="normal">Normal conditions</option></select></label>
      <Button disabled={busy} onClick={() => void run("replay", { scenario }, "Weather replay ingested. Warnings and case checks have refreshed.")}>{busy ? "Processing…" : "Run weather replay"}</Button>
      <p className="w-full text-xs text-amber-300">Replay readings are simulated and are labelled in the feed.</p>
    </div>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm"><caption className="sr-only">Recent weather and river readings</caption><thead className="text-xs text-muted"><tr><th className="pb-2 pr-4">Station / observed</th><th className="pb-2 pr-4">Rain / 1h</th><th className="pb-2 pr-4">River / danger</th><th className="pb-2">Source</th></tr></thead>
        <tbody>{snapshot.weather.slice(0, 8).map((reading) => <tr key={reading.id} className="border-t border-slate-800"><td className="py-3 pr-4">{reading.stationId}<span className="block text-xs text-muted">{new Date(reading.observedAt).toLocaleString()}</span></td><td className="pr-4">{reading.rainfallMm} mm</td><td className="pr-4">{reading.waterLevelM} / {reading.dangerLevelM} m</td><td>{reading.source}</td></tr>)}</tbody>
      </table>
      {!snapshot.weather.length ? <p className="py-4 text-sm text-muted">No weather readings yet. Run a replay or record a station reading.</p> : null}
    </div>
    <details className="mt-4 rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-medium">Record a station reading</summary>
      <form className="mt-4" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        void run("weather", { stationId: String(form.get("stationId") ?? "").trim(), location: { latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")) }, rainfallMm: Number(form.get("rainfallMm")), waterLevelM: Number(form.get("waterLevelM")), dangerLevelM: Number(form.get("dangerLevelM")), observedAt: new Date(String(form.get("observedAt"))).toISOString() }, "Station reading saved. Relevant case checks and area warnings have refreshed.");
      }}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm">Station ID<Input name="stationId" required minLength={2} maxLength={100} /></label>
        <label className="space-y-2 text-sm">Observation time (local)<Input name="observedAt" required type="datetime-local" /></label>
        <label className="space-y-2 text-sm">Station latitude<Input name="latitude" required type="number" step="any" min={-85} max={85} /></label>
        <label className="space-y-2 text-sm">Station longitude<Input name="longitude" required type="number" step="any" min={-180} max={180} /></label>
        <label className="space-y-2 text-sm">Rain in previous hour (mm)<Input name="rainfallMm" required type="number" step="0.1" min={0} max={3000} /></label>
        <label className="space-y-2 text-sm">River level (m)<Input name="waterLevelM" required type="number" step="0.01" min={0} max={100} /></label>
        <label className="space-y-2 text-sm">Danger level (m)<Input name="dangerLevelM" required type="number" step="0.01" min={0.01} max={100} /></label>
        <Button className="self-end" type="submit" disabled={busy}>Save station reading</Button>
      </fieldset></form>
    </details>
    <p className="mt-4 text-xs text-muted">Current thresholds: rain {snapshot.thresholds.rainMm} mm in 1 hour · {snapshot.thresholds.clusterCount} independent reports · AI confirmation at {Math.round(snapshot.thresholds.autoConfirmConfidence * 100)}% confidence. Human review feedback recorded: {snapshot.thresholds.feedbackCount}.</p>
  </Card>;
}
