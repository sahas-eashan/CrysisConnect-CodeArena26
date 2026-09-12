"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { GeoPoint, HazardRole } from "@/lib/hazards/types";
import { CaseCard } from "./case-card";
import { HazardMap } from "./hazard-map";
import { ReportForm, fieldClass } from "./report-form";
import { useHazardActions, useHazards } from "./use-hazards";
import { WeatherPanel } from "./weather-panel";

const titles = { citizen: "Report, verify and get help", government: "Hazard verification and response", ngo: "Field response and clearance" };
const descriptions = { citizen: "Follow your report from photo evidence to verification, assistance and resolution.", government: "Review weather and citizen evidence, broadcast confirmed hazards, and coordinate crews and relief.", ngo: "Review your assigned hazards and submit clearance photos when field work is complete." };

export function HazardWorkspace({ role }: { role: HazardRole }) {
  const [reportLocation, setReportLocation] = useState<GeoPoint | null>(null);
  const { coordinates, error: gpsError, loading: locating, requestLocation } = useGeolocation();
  const point = coordinates ?? reportLocation;
  const { snapshot, error, loading, refresh } = useHazards(role, role === "citizen" ? point : undefined);
  const actions = useHazardActions(role, refresh);
  const [filter, setFilter] = useState("all");
  const cases = (snapshot?.cases ?? []).filter((item) => (role !== "ngo" || Boolean(item.assignedCrew)) && (filter === "all" || item.status === filter));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-white">{titles[role]}</h1><p className="mt-2 max-w-3xl text-sm text-muted">{descriptions[role]}</p></div><Button onClick={() => void refresh()} variant="outline">Refresh</Button></div>
    {snapshot?.storageMode === "local-demo" ? <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
      <p>Local demonstration · {role === "government" ? "Government reviewer" : role === "ngo" ? "NGO crew" : "Citizen reporter"}. Cases are saved on this server and shared across the three demo roles.</p>
      <div className="mt-2 flex flex-wrap gap-4"><Link className="underline" href="/citizen/hazards">Citizen reports</Link><Link className="underline" href="/admin/hazards">Government review</Link><Link className="underline" href="/ngo/hazards">NGO field queue</Link></div>
    </div> : null}
    {error || actions.error ? <div role="alert" className="rounded-xl border border-red-700/50 bg-red-950/30 p-4 text-sm text-red-200">{actions.error ?? error}{snapshot && error ? " Showing the last successful update." : ""}</div> : null}
    {actions.message ? <p role="status" className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">{actions.message}</p> : null}
    {loading ? <p role="status" className="text-sm text-muted">Loading shared hazard cases…</p> : null}
    {role === "citizen" ? <ReportForm run={actions.run} busy={actions.busy} onLocation={setReportLocation} /> : null}
    {snapshot && role === "government" ? <WeatherPanel snapshot={snapshot} run={actions.run} busy={actions.busy} /> : null}
    {snapshot ? <HazardMap snapshot={snapshot} point={role === "citizen" ? point : undefined} role={role} onLocate={role === "citizen" ? requestLocation : undefined} locationError={gpsError} locating={locating} /> : null}
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><CardTitle>{role === "citizen" ? "Your reported cases" : role === "ngo" ? "Your assigned cases" : "Verification and response queue"}</CardTitle><CardDescription className="mt-2">Updates refresh every 10 seconds.{snapshot ? ` Last updated ${new Date(snapshot.generatedAt).toLocaleTimeString()}.` : ""}</CardDescription></div>
        <label className="space-y-2 text-sm">Filter by status<select className={fieldClass} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="needs_verification">Needs verification</option><option value="confirmed">Confirmed</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label>
      </div>
      <div className="mt-5 space-y-4">{snapshot ? cases.map((item) => <CaseCard key={item.id} item={item} role={role} snapshot={snapshot} run={actions.run} busy={actions.busy} />) : null}
        {!loading && snapshot && !cases.length ? <p className="rounded-xl border border-slate-800 p-4 text-sm text-muted">{role === "ngo" ? "No cases assigned to your crew in this view." : role === "citizen" ? "No reports in this view. Submit a hazard report to begin." : "No cases in this view. Citizen reports and weather warnings will appear here."}</p> : null}
      </div>
    </Card>
  </div>;
}
