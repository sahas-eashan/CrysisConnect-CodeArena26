"use client";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { HazardSnapshot } from "@/lib/hazards/types";
import { fieldClass } from "./report-form";
import type { RunHazardAction } from "./use-hazards";

export function ModerationPanel({ snapshot, run, busy }: { snapshot: HazardSnapshot; run: RunHazardAction; busy: boolean }) {
  return <Card><CardTitle>Reporter moderation</CardTitle><CardDescription className="mt-2">Review rejected cases before restricting reporting. Restrictions and reversals require an officer reason and remain in the audit history.</CardDescription>
    <div className="mt-4 space-y-3">{snapshot.reporters?.map((reporter) => <div key={reporter.id} className="rounded-xl border border-slate-700 p-3">
      <p className="break-all text-sm font-medium">{reporter.id}</p><p className="mt-1 text-xs text-muted">{reporter.reports} reports · {reporter.rejected} rejected · {reporter.banned ? "Reporting restricted" : "Reporting allowed"}</p>
      {reporter.reason ? <p className="mt-2 text-sm text-amber-200">{reporter.reason}</p> : null}
      {reporter.banned ? <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void run("unbanReporter", { reporterId: reporter.id, reason: String(form.get("reason") ?? "").trim() }, "Reporting restriction lifted with an audit reason."); }}>
        <label className="block space-y-2 text-sm">Reason to restore reporting<textarea className={fieldClass} rows={2} name="reason" minLength={10} maxLength={1500} required disabled={busy} /></label><Button type="submit" disabled={busy} variant="outline">Restore reporting access</Button>
      </form> : null}
    </div>)}</div>
    {!snapshot.reporters?.length ? <p className="mt-4 text-sm text-muted">No citizen reporters to review yet.</p> : null}
  </Card>;
}
