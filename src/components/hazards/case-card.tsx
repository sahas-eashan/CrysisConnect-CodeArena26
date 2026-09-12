"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HazardCase, HazardRole, HazardSnapshot, PhotoInput } from "@/lib/hazards/types";
import { toTitleCase } from "@/lib/utils";
import { PhotoField } from "./photo-field";
import { fieldClass } from "./report-form";
import type { RunHazardAction } from "./use-hazards";
import { ReliefActions } from "./relief-actions";

export function CaseCard({ item, role, snapshot, run, busy }: { item: HazardCase; role: HazardRole; snapshot: HazardSnapshot; run: RunHazardAction; busy: boolean }) {
  const terminal = item.status === "resolved";
  const evidenceRequest = item.informationRequest;
  return <article className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4" aria-label={item.title}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold text-white">{item.title}</h3><p className="mt-1 text-xs text-muted">{item.kind.replaceAll("_", " ")} · {item.source === "weather" ? "Weather feed" : "Citizen report"} · {new Date(item.createdAt).toLocaleString()}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs ${item.status === "resolved" ? "bg-emerald-900/50 text-emerald-200" : item.status === "rejected" ? "bg-slate-800 text-slate-300" : "bg-sky-900/40 text-sky-200"}`}>{toTitleCase(item.status)}</span>
    </div>
    <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{item.description}</p>
    <p className="break-words text-xs text-muted">GPS: {item.location.latitude.toFixed(5)}, {item.location.longitude.toFixed(5)} · Case {item.id}</p>
    <div className="flex flex-wrap gap-2 text-xs"><span className={`rounded-full border px-3 py-1 ${["high", "critical"].includes(item.verdict.urgency ?? "") ? "border-red-700 text-red-200" : "border-slate-700 text-slate-200"}`}>Urgency: {toTitleCase(item.verdict.urgency ?? "unknown")}</span>
      {item.geography?.ward ? <span className="rounded-full border border-slate-700 px-3 py-1">Ward: {item.geography.ward.name}</span> : null}
      {item.geography?.road ? <span className="rounded-full border border-slate-700 px-3 py-1">Road: {item.geography.road.name} ({Math.round(item.geography.road.distanceM)} m away)</span> : null}
    </div>
    {item.geography ? <p className="text-xs text-muted">{item.geography.reason}{item.geography.fixture ? " Demonstration boundaries." : ""}</p> : null}
    {item.councilTicket ? <p className="text-sm text-sky-200">Responsible council: {item.councilTicket.councilName} · Ticket {item.councilTicket.id} ({item.councilTicket.status}) · Assigned {item.councilTicket.assignmentSource === "geography" ? "from mapped ward" : "by an officer"}</p> : <p className="text-xs text-amber-200">Responsible council has not been assigned.</p>}
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-sm font-medium">Verdict: {toTitleCase(item.verdict.decision)} · {item.verdict.origin === "ai" ? "AI aggregator" : item.verdict.origin === "human" ? "Human reviewer" : "System fallback"}</p>
      <p className="mt-1 text-sm text-muted">{item.verdict.reason}</p>
      <p className="mt-2 text-xs text-sky-200">{item.verdict.confidence === null ? "Confidence unavailable" : `${item.verdict.origin === "ai" ? "Model estimate (uncalibrated)" : item.verdict.origin === "human" ? "Reviewer confidence" : "System evidence score"}: ${Math.round(item.verdict.confidence * 100)}%`}{item.verdict.model ? ` · ${item.verdict.model}` : ""}</p>
    </div>
    <details className="rounded-xl border border-slate-800 p-3">
      <summary className="cursor-pointer text-sm font-medium">Verification checks and evidence ({item.checks.length})</summary>
      <div className="mt-3 space-y-3">{item.checks.map((check) => <div key={check.id} className="border-l-2 border-slate-600 pl-3">
        <p className="text-sm font-medium">{toTitleCase(check.id)} · {check.engine} · {toTitleCase(check.status)}</p>
        <p className="mt-1 text-sm text-muted">{check.reason}</p>
        {check.engine === "AI" && check.confidence !== null ? <p className="mt-1 text-xs text-muted">Model estimate (uncalibrated): {Math.round(check.confidence * 100)}%</p> : null}
        {check.evidence.map((evidence, index) => <p className="mt-1 break-words text-xs text-muted" key={index}>{evidence}</p>)}
      </div>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">{item.evidence.map((evidence) => <figure key={evidence.id}>
        <img className="h-32 w-full rounded-lg object-cover" src={evidence.dataUrl} alt={`${toTitleCase(evidence.kind)} evidence for ${item.title}`} loading="lazy" />
        <figcaption className="mt-1 text-xs text-muted">{toTitleCase(evidence.kind)} · {new Date(evidence.uploadedAt).toLocaleString()}{evidence.notes ? ` · ${evidence.notes}` : ""}</figcaption>
        {evidence.metadata ? <div className={`mt-2 rounded-lg border p-2 text-xs ${evidence.metadata.status === "gps_mismatch" ? "border-amber-700 text-amber-200" : "border-slate-700 text-muted"}`}><p className="font-medium">Photo location: {toTitleCase(evidence.metadata.status)}</p><p className="mt-1">{evidence.metadata.reason}</p>{evidence.metadata.gps ? <p className="mt-1">Embedded GPS: {evidence.metadata.gps.latitude.toFixed(5)}, {evidence.metadata.gps.longitude.toFixed(5)}</p> : null}{evidence.metadata.capturedAt || evidence.metadata.capturedAtRaw ? <p className="mt-1">Embedded capture time: {evidence.metadata.capturedAt ?? evidence.metadata.capturedAtRaw}</p> : null}<p className="mt-1">Photo metadata can be edited and is supporting evidence only.</p></div> : null}
      </figure>)}</div>
    </details>
    {item.checks.some((check) => check.engine === "AI" && check.status === "unavailable") ? <p className="text-xs text-amber-300">Some AI checks are unavailable. Review the available evidence and system checks; an unavailable check does not confirm a hazard.</p> : null}
    {item.assignedCrew ? <p className="text-sm text-sky-200">Assigned crew: {item.assignedCrew.name}</p> : null}
    {item.helpRequested ? <p className="text-sm text-amber-200">Help requested: {item.needs}</p> : null}
    {evidenceRequest ? <p className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">More information requested: {evidenceRequest.notes}</p> : null}
    {item.relief ? <p className="text-sm text-emerald-200">Relief: {item.relief.organization} — {item.relief.resources}{item.relief.shelterId ? ` · ${item.relief.people} shelter places allocated` : ""}</p> : null}
    <details className="rounded-xl border border-slate-800 p-3">
      <summary className="cursor-pointer text-sm font-medium">Status history ({item.history.length})</summary>
      <ol className="mt-3 space-y-3">{[...item.history].reverse().map((entry) => <li className="text-sm" key={entry.id}>
        <p className="font-medium">{toTitleCase(entry.action)} <span className="text-xs font-normal text-muted">· {new Date(entry.at).toLocaleString()}</span></p><p className="mt-1 whitespace-pre-wrap text-muted">{entry.notes}</p>
      </li>)}</ol>
    </details>
    {!terminal && role === "government" ? <GovernmentActions item={item} snapshot={snapshot} run={run} busy={busy} /> : null}
    {!terminal && role === "citizen" ? <EvidenceAction item={item} run={run} busy={busy} closure={false} /> : null}
    {!terminal && role === "ngo" && item.status === "assigned" ? <EvidenceAction item={item} run={run} busy={busy} closure /> : null}
    {!terminal && role === "relief" && ["confirmed", "assigned"].includes(item.status) && item.helpRequested ? <ReliefActions item={item} snapshot={snapshot} run={run} busy={busy} /> : null}
    {item.relief?.shelterId && (role === "government" || role === "ngo" || role === "relief") ? <ReleaseShelter item={item} run={run} busy={busy} /> : null}
  </article>;
}

function ReleaseShelter({ item, run, busy }: { item: HazardCase; run: RunHazardAction; busy: boolean }) {
  return <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-medium">Release shelter allocation</summary>
    <p className="mt-3 text-sm text-muted">Release these places only after the people allocated to this case have left the shelter.</p>
    <form className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault(); const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
      void run("releaseRelief", { id: item.id, notes }, "Shelter places released. Available capacity has been updated.");
    }}><label className="block space-y-2 text-sm">Departure confirmation<textarea className={fieldClass} rows={2} name="notes" minLength={5} maxLength={1500} required disabled={busy} /></label><Button type="submit" variant="outline" disabled={busy}>Confirm departure and release places</Button></form>
  </details>;
}

function EvidenceAction({ item, run, busy, closure }: { item: HazardCase; run: RunHazardAction; busy: boolean; closure: boolean }) {
  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const [key, setKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!photo) return;
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    const success = await run(closure ? "close" : "evidence", { id: item.id, photo, notes }, closure ? "Case closed with photo evidence. The hazard map and area alert have been updated." : "Additional evidence saved and verification updated.");
    if (success) { setPhoto(null); setKey((value) => value + 1); }
  }
  return <details className="rounded-xl border border-slate-700 p-3">
    <summary className="cursor-pointer text-sm font-medium">{closure ? "Close hazard with field evidence" : "Provide more evidence"}</summary>
    <form key={key} className="mt-4 space-y-3" onSubmit={submit}><fieldset className="space-y-3" disabled={busy}>
      <PhotoField value={photo} onChange={setPhoto} label={closure ? "Clearance photo" : "Additional photo"} />
      <label className="block space-y-2 text-sm">{closure ? "What was cleared and checked?" : "What does this photo show?"}<textarea className={fieldClass} rows={2} name="notes" required minLength={5} maxLength={1500} /></label>
      <Button type="submit" disabled={busy || !photo} variant={closure ? "success" : "outline"}>{busy ? "Saving…" : closure ? "Confirm clearance and close" : "Submit additional evidence"}</Button>
    </fieldset></form>
  </details>;
}

function GovernmentActions({ item, snapshot, run, busy }: { item: HazardCase; snapshot: HazardSnapshot; run: RunHazardAction; busy: boolean }) {
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState(item.verdict.urgency ?? "unknown");
  const councils = snapshot.councils ?? [];
  const reviewable = item.status === "needs_verification" || item.status === "confirmed" || item.status === "rejected";
  const dispatchable = item.status === "confirmed" || item.status === "assigned";
  return <div className="space-y-4 border-t border-slate-700 pt-4">
    {reviewable ? <div className="space-y-3">
      <label className="block space-y-2 text-sm">Reviewer note<textarea className={fieldClass} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} minLength={5} maxLength={1500} placeholder="Describe the evidence supporting your decision" /></label>
      <label className="block space-y-2 text-sm">Reviewer urgency<select className={fieldClass} value={urgency} onChange={(event) => setUrgency(event.target.value as typeof urgency)} disabled={busy}><option value="unknown">Unknown — needs assessment</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></select></label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || notes.trim().length < 5} variant="success" onClick={() => void run("review", { id: item.id, decision: "confirmed", notes, urgency }, "Hazard confirmed. An area warning is now visible to residents.")}>Confirm hazard</Button>
        <Button disabled={busy || notes.trim().length < 5} variant="danger" onClick={() => void run("review", { id: item.id, decision: "rejected", notes, urgency }, "Case rejected with a recorded reason.")}>Reject report</Button>
        {item.status === "needs_verification" || item.status === "rejected" ? <Button disabled={busy || notes.trim().length < 5} variant="outline" onClick={() => void run("requestEvidence", { id: item.id, notes }, "Request for more evidence sent to the reporting citizen.")}>Request more information</Button> : null}
        <Button disabled={busy || notes.trim().length < 5} variant="outline" onClick={() => void run("requestCommunity", { id: item.id, notes }, "Verification invitations sent to eligible nearby residents.")}>Ask nearby residents to verify</Button>
      </div>
    </div> : null}
    <details className="rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-medium">Assign responsible council</summary>
      <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const selected = councils.find((council) => council.id === form.get("councilId")); if (selected) void run("assignCouncil", { id: item.id, councilId: selected.id, councilName: selected.name, notes: String(form.get("notes") ?? "").trim() }, "Responsible council updated and the assignment recorded."); }}>
        <label className="block space-y-2 text-sm">Responsible council<select className={fieldClass} name="councilId" required defaultValue={item.councilTicket?.councilId ?? ""} disabled={busy}><option value="">Select a council</option>{councils.map((council) => <option key={council.id} value={council.id}>{council.name}</option>)}</select></label>
        <label className="block space-y-2 text-sm">Council assignment reason<textarea className={fieldClass} name="notes" rows={2} minLength={5} maxLength={1500} required disabled={busy} /></label><Button disabled={busy || !councils.length} type="submit" variant="outline">Save council assignment</Button>
        {!councils.length ? <p className="text-xs text-amber-200">No council directory is configured for this server.</p> : null}
      </form>
    </details>
    {item.status === "rejected" && item.source === "citizen" && !snapshot.reporters?.find((reporter) => reporter.id === item.reportedBy)?.banned ? <details className="rounded-xl border border-red-900/60 p-3"><summary className="cursor-pointer text-sm font-medium">Restrict false reporting</summary><p className="mt-3 text-sm text-muted">A rejected report alone may be a mistake. Record why this reporter's conduct warrants a reporting restriction.</p>
      <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run("banReporter", { reporterId: item.reportedBy, caseId: item.id, reason: String(form.get("reason") ?? "").trim() }, "Reporting restricted with a recorded reason. Existing reports remain available for review."); }}>
        <label className="block space-y-2 text-sm">Reason for reporting restriction<textarea className={fieldClass} name="reason" rows={2} minLength={10} maxLength={1500} required disabled={busy} /></label><Button variant="danger" disabled={busy} type="submit">Restrict this reporter</Button>
      </form>
    </details> : null}
    {dispatchable ? <details className="rounded-xl border border-slate-700 p-3">
      <summary className="cursor-pointer text-sm font-medium">Dispatch a response crew</summary>
      <form className="mt-3 space-y-3" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        void run("assign", { id: item.id, crew: { id: String(form.get("crewId") ?? "").trim(), name: String(form.get("crewName") ?? "").trim() } }, "Response crew assigned. The NGO queue has been updated.");
      }}><fieldset className="space-y-3" disabled={busy}>
        <label className="block space-y-2 text-sm">Crew member ID<Input name="crewId" required defaultValue={item.assignedCrew?.id ?? (snapshot.storageMode === "local-demo" ? "demo-ngo" : "")} /></label>
        <label className="block space-y-2 text-sm">Crew name<Input name="crewName" required minLength={2} defaultValue={item.assignedCrew?.name ?? (snapshot.storageMode === "local-demo" ? "Demo NGO response crew" : "")} /></label>
        <Button type="submit" disabled={busy}>Assign crew</Button>
      </fieldset></form>
    </details> : null}
    {dispatchable && item.helpRequested ? <ReliefActions item={item} snapshot={snapshot} run={run} busy={busy} /> : null}
  </div>;
}
