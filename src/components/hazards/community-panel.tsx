"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { CommunityInvitation, GeoPoint, PhotoInput } from "@/lib/hazards/types";
import { PhotoField } from "./photo-field";
import { fieldClass } from "./report-form";
import type { RunHazardAction } from "./use-hazards";

export function CommunityPanel({ invitations, point, onLocate, run, busy }: { invitations: CommunityInvitation[]; point: GeoPoint | null; onLocate: () => void; run: RunHazardAction; busy: boolean }) {
  return <Card><CardTitle>Nearby community verification</CardTitle><CardDescription className="mt-2">Officers can ask nearby residents for a separate observation. Share your location to receive requests. Respond only from a place you can reach safely.</CardDescription>
    <div className="mt-4 space-y-4">{invitations.length ? invitations.map((invitation) => <InvitationForm key={invitation.id} invitation={invitation} point={point} onLocate={onLocate} run={run} busy={busy} />) : <p className="text-sm text-muted">No verification requests for you at the moment.</p>}</div>
  </Card>;
}

function InvitationForm({ invitation, point, onLocate, run, busy }: { invitation: CommunityInvitation; point: GeoPoint | null; onLocate: () => void; run: RunHazardAction; busy: boolean }) {
  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const pending = invitation.status === "pending" && Date.parse(invitation.expiresAt) > Date.now();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!photo || !point) return;
    const form = new FormData(event.currentTarget);
    if (await run("confirmCommunity", { invitationId: invitation.id, location: point, photo, notes: String(form.get("notes") ?? "").trim(), observation: form.get("observation") }, "Your independent observation was sent to the reviewer.")) setPhoto(null);
  }
  return <article aria-label={`Community request: ${invitation.title}`} className="space-y-3 rounded-xl border border-slate-700 p-4">
    <h3 className="font-medium">{invitation.title}</h3><p className="text-sm text-muted">{invitation.notes}</p>
    <p className="text-xs text-muted">{invitation.location.latitude.toFixed(5)}, {invitation.location.longitude.toFixed(5)} · Expires {new Date(invitation.expiresAt).toLocaleString()}</p>
    {pending ? <form className="space-y-3" onSubmit={submit}><fieldset disabled={busy} className="space-y-3">
      <label className="block space-y-2 text-sm">Your observation<select name="observation" className={fieldClass}><option value="supports">I can see this hazard</option><option value="contradicts">Current conditions contradict this report</option></select></label>
      <PhotoField value={photo} onChange={setPhoto} label="Community verification photo" />
      <label className="block space-y-2 text-sm">What can you observe?<textarea name="notes" className={fieldClass} required minLength={5} maxLength={1500} rows={2} /></label>
      {point ? <p className="text-xs text-sky-200">Your shared location: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</p> : <Button variant="outline" onClick={onLocate}>Share location for this observation</Button>}
      <Button type="submit" disabled={busy || !photo || !point}>Submit independent observation</Button>
    </fieldset></form> : <p className="text-sm text-sky-200">{invitation.status === "responded" ? `Observation recorded: ${invitation.response?.observation ?? "submitted"}.` : invitation.status === "cancelled" ? "This request has been cancelled." : "This request has expired."}</p>}
  </article>;
}
