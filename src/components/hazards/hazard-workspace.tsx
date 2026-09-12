"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useGeolocation } from "@/hooks/use-geolocation";
import { hazardRequest } from "@/lib/hazards/client";
import type { GeoPoint, HazardRole } from "@/lib/hazards/types";
import { CaseCard } from "./case-card";
import { CommunityPanel } from "./community-panel";
import { HazardMap } from "./hazard-map";
import { ModerationPanel } from "./moderation-panel";
import { ReportForm, fieldClass } from "./report-form";
import { useHazardActions, useHazards } from "./use-hazards";
import { WeatherPanel } from "./weather-panel";

const titles = { citizen: "Report, verify and get help", government: "Hazard verification and response", ngo: "Field response and clearance", relief: "Relief requests and shelter coordination" };
const descriptions = { citizen: "Follow your report from photo evidence to verification, assistance and resolution.", government: "Review evidence by urgency and council, warn residents, and coordinate the response.", ngo: "Review your assigned hazards and submit clearance photos when field work is complete.", relief: "Match affected households to assistance and available shelters, then record departures to release capacity." };
const urgencyOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3, unknown: 4 };

export function HazardWorkspace({ role }: { role: HazardRole }) {
  const [demoProfile, setDemoProfile] = useState("reporter");
  return <HazardWorkspaceContent key={`${role}:${demoProfile}`} role={role} demoProfile={demoProfile} onProfile={setDemoProfile} />;
}

function HazardWorkspaceContent({ role, demoProfile, onProfile }: { role: HazardRole; demoProfile: string; onProfile: (profile: string) => void }) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const { coordinates, error: gpsError, loading: locating, requestLocation } = useGeolocation();
  const { snapshot, error, loading, refresh } = useHazards(role, role === "citizen" ? point : undefined, demoProfile);
  const actions = useHazardActions(role, refresh, demoProfile);
  const storedLocationFresh = snapshot?.resident?.alertsEnabled && snapshot.resident.locationUpdatedAt && Date.now() - Date.parse(snapshot.resident.locationUpdatedAt) <= 24 * 60 * 60_000;
  const mapPoint = point ?? (storedLocationFresh ? snapshot?.resident?.location : null) ?? null;
  const [filter, setFilter] = useState("all");
  const [council, setCouncil] = useState("all");
  const [ward, setWard] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const shareLocation = useCallback((location: GeoPoint) => { setPoint(location); }, []);
  useEffect(() => { if (coordinates) shareLocation(coordinates); }, [coordinates, shareLocation]);
  useEffect(() => {
    if (role !== "citizen" || !point) return;
    let active = true;
    void hazardRequest("location", { location: point, alertsEnabled: true }, role, demoProfile).then(() => { if (active) { setSharingError(null); void refresh(); } }).catch((cause) => { if (active) setSharingError(cause instanceof Error ? cause.message : "Unable to share location for nearby verification."); });
    return () => { active = false; };
  }, [point, role, demoProfile, refresh]);
  const cases = (snapshot?.cases ?? []).filter((item) =>
    (role !== "ngo" || Boolean(item.assignedCrew)) && (role !== "relief" || item.helpRequested || Boolean(item.relief)) &&
    (filter === "all" || item.status === filter) && (council === "all" || (item.councilTicket?.councilId ?? item.geography?.council?.id) === council) &&
    (ward === "all" || item.geography?.ward?.id === ward) && (urgency === "all" || (item.verdict.urgency ?? "unknown") === urgency)
  ).sort((a, b) => (urgencyOrder[a.verdict.urgency ?? "unknown"] - urgencyOrder[b.verdict.urgency ?? "unknown"]) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-white">{titles[role]}</h1><p className="mt-2 max-w-3xl text-sm text-muted">{descriptions[role]}</p></div><Button onClick={() => void refresh()} variant="outline">Refresh</Button></div>
    {snapshot?.storageMode === "local-demo" ? <div className="space-y-3 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
      <p>Local demonstration · {role === "government" ? "Government reviewer" : role === "ngo" ? "NGO crew" : role === "relief" ? "Relief coordinator" : "Citizen reporter"}. Cases are saved on this server and shared across the demo roles.</p>
      <div className="flex flex-wrap gap-4"><Link className="underline" href="/citizen/hazards">Citizen reports</Link><Link className="underline" href="/admin/hazards">Government review</Link><Link className="underline" href="/ngo/hazards">NGO field queue</Link><Link className="underline" href="/relief/hazards">Relief coordinator</Link><Link className="underline" href="/public-map">Public map</Link></div>
      {role === "citizen" ? <label className="block max-w-sm space-y-2">Demo citizen<select className={fieldClass} value={demoProfile} onChange={(event) => onProfile(event.target.value)}><option value="reporter">Original reporter</option><option value="neighbor">Nearby resident</option><option value="neighbor2">Second nearby resident</option></select></label> : null}
    </div> : null}
    {error || actions.error || sharingError ? <div role="alert" className="rounded-xl border border-red-700/50 bg-red-950/30 p-4 text-sm text-red-200">{actions.error ?? sharingError ?? error}{snapshot && error ? " Showing the last successful update." : ""}</div> : null}
    {actions.message ? <p role="status" className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">{actions.message}</p> : null}
    {loading ? <p role="status" className="text-sm text-muted">Loading shared hazard cases…</p> : null}
    {role === "citizen" ? <>
      <Card><CardTitle>Location and area warnings</CardTitle><CardDescription className="mt-2">Sharing your location enables nearby warnings with automatic route guidance and invitations to verify reports. You can stop sharing at any time.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-3"><Button onClick={requestLocation} variant="outline" disabled={locating}>{locating ? "Capturing GPS…" : "Share location for alerts and verification"}</Button>
          {point || snapshot?.resident ? <Button variant="outline" disabled={actions.busy} onClick={async () => { if (await actions.run("forgetLocation", {}, "Stored location removed and nearby invitations disabled.")) setPoint(null); }}>Stop sharing and remove location</Button> : null}</div>
        {point ? <p className="mt-3 text-xs text-sky-200">Using {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} for nearby updates.</p> : null}
        {!point && snapshot?.resident?.location ? <p className="mt-3 text-xs text-amber-200">{storedLocationFresh ? "Warnings use your last shared location. Capture your current location if you have moved, or before responding to a community request." : "Your shared location has expired. Capture your current location to resume nearby updates."}</p> : null}
        {gpsError ? <p role="alert" className="mt-3 text-sm text-red-300">{gpsError}</p> : null}
      </Card>
      <ReportForm run={actions.run} busy={actions.busy} onLocation={shareLocation} />
      {snapshot ? <CommunityPanel invitations={snapshot.invitations ?? []} point={point} onLocate={requestLocation} run={actions.run} busy={actions.busy} /> : null}
    </> : null}
    {snapshot && role === "government" ? <WeatherPanel snapshot={snapshot} run={actions.run} busy={actions.busy} /> : null}
    {snapshot && role === "relief" ? <Card><CardTitle>Shelter availability</CardTitle><CardDescription className="mt-2">Reservations update the shared capacity immediately. Release places when residents leave.</CardDescription><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{snapshot.shelters.map((shelter) => <div key={shelter.id} className="rounded-xl border border-slate-700 p-4"><h3 className="text-sm font-medium">{shelter.name}</h3><p className="mt-2 text-2xl font-semibold text-sky-200">{shelter.available}<span className="text-sm font-normal text-muted"> / {shelter.capacity} available</span></p>{shelter.fixture ? <p className="mt-2 text-xs text-amber-200">Demonstration shelter</p> : null}</div>)}</div></Card> : null}
    {snapshot ? <HazardMap snapshot={snapshot} point={role === "citizen" ? mapPoint : undefined} role={role} onLocate={role === "citizen" ? requestLocation : undefined} locationError={gpsError} locating={locating} stale={Boolean(error)} demoProfile={demoProfile} /> : null}
    <Card>
      <div><CardTitle>{role === "citizen" ? "Your reported cases" : role === "ngo" ? "Your assigned cases" : role === "relief" ? "Households needing assistance" : "Verification and response queue"}</CardTitle><CardDescription className="mt-2">Highest urgency first. Updates refresh every 10 seconds.{snapshot ? ` Last updated ${new Date(snapshot.generatedAt).toLocaleTimeString()}.` : ""}</CardDescription></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm">Filter by status<select className={fieldClass} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="needs_verification">Needs verification</option><option value="confirmed">Confirmed</option><option value="assigned">Assigned</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select></label>
        <label className="space-y-2 text-sm">Filter by council<select className={fieldClass} value={council} onChange={(event) => { setCouncil(event.target.value); setWard("all"); }}><option value="all">All councils</option>{snapshot?.councils?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="space-y-2 text-sm">Filter by ward<select className={fieldClass} value={ward} onChange={(event) => setWard(event.target.value)}><option value="all">All wards</option>{snapshot?.wards?.filter((item) => council === "all" || item.councilId === council).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="space-y-2 text-sm">Filter by urgency<select className={fieldClass} value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="all">All urgency levels</option><option value="critical">Critical</option><option value="high">High</option><option value="moderate">Moderate</option><option value="low">Low</option><option value="unknown">Unknown</option></select></label>
      </div>
      <div className="mt-5 space-y-4">{snapshot ? cases.map((item) => <CaseCard key={item.id} item={item} role={role} snapshot={snapshot} run={actions.run} busy={actions.busy} />) : null}
        {!loading && snapshot && !cases.length ? <p className="rounded-xl border border-slate-800 p-4 text-sm text-muted">{role === "ngo" ? "No cases assigned to your crew in this view." : role === "citizen" ? "No reports in this view. Submit a hazard report to begin." : role === "relief" ? "No assistance requests in this view." : "No cases in this view. Citizen reports and weather warnings will appear here."}</p> : null}
      </div>
    </Card>
    {snapshot && role === "government" ? <ModerationPanel snapshot={snapshot} run={actions.run} busy={actions.busy} /> : null}
  </div>;
}
