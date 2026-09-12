"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HazardCase, HazardSnapshot } from "@/lib/hazards/types";
import { fieldClass } from "./report-form";
import { RouteSummary } from "./route-summary";
import type { RunHazardAction } from "./use-hazards";

export function ReliefActions({ item, snapshot, run, busy }: { item: HazardCase; snapshot: HazardSnapshot; run: RunHazardAction; busy: boolean }) {
  const [shelterId, setShelterId] = useState("");
  const [mode, setMode] = useState("manual");
  return <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-medium">Allocate relief and shelter</summary>
    <form className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      void run(mode === "nearest" ? "autoRelief" : "relief", { id: item.id, organization: String(form.get("organization") ?? "").trim(), resources: String(form.get("resources") ?? "").trim(), ...(mode === "nearest" ? { people: Number(form.get("people")) } : shelterId ? { shelterId, people: Number(form.get("people")) } : {}) }, mode === "nearest" ? "Shelter allocation saved. Review route status and any crew assistance instructions below." : "Relief assignment saved and shelter capacity updated.");
    }}><fieldset className="space-y-3" disabled={busy}>
      <label className="block space-y-2 text-sm">Relief organization<Input name="organization" required minLength={2} defaultValue={item.relief?.organization ?? ""} /></label>
      <label className="block space-y-2 text-sm">Resources and delivery details<textarea name="resources" className={fieldClass} rows={2} required minLength={5} defaultValue={item.relief?.resources ?? ""} /></label>
      <label className="block space-y-2 text-sm">Allocation method<select className={fieldClass} value={mode} onChange={(event) => setMode(event.target.value)}><option value="manual">Choose shelter manually</option><option value="nearest">Find nearest safe shelter with capacity</option></select></label>
      {mode === "manual" ? <label className="block space-y-2 text-sm">Shelter allocation<select className={fieldClass} value={shelterId} onChange={(event) => setShelterId(event.target.value)}><option value="">No shelter allocation</option>{snapshot.shelters.map((shelter) => <option key={shelter.id} value={shelter.id} disabled={shelter.available < 1}>{shelter.name} — {shelter.available} places{shelter.fixture ? " (demo)" : ""}</option>)}</select></label> : <p className="text-xs text-muted">The server checks known hazards, road routes and remaining places. People inside a hazard may need extraction by a crew; a shelter reservation does not mean they have a safe route to travel there.</p>}
      {shelterId || mode === "nearest" ? <label className="block space-y-2 text-sm">People to accommodate<Input name="people" type="number" min={1} step={1} max={mode === "manual" ? snapshot.shelters.find((shelter) => shelter.id === shelterId)?.available : undefined} required /></label> : null}
      <Button type="submit" disabled={busy}>{mode === "nearest" ? "Find and reserve nearest shelter" : "Save relief allocation"}</Button>
    </fieldset></form>
    {item.relief?.route ? <div className="mt-4"><p className="mb-2 text-xs text-muted">Route checked when this allocation was made. Current area alerts carry refreshed guidance.</p><RouteSummary route={item.relief.route} /></div> : null}
  </details>;
}
