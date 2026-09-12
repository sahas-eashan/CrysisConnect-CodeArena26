import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mockDisasters, mockResourceRequests, mockResources, mockSOSSignals } from "@/lib/mock-data";

export default function NgoDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active missions" value={3} helper="Open responder tasks" />
        <StatCard label="Tracked resources" value={mockResources.length} helper="Published inventory items" />
        <StatCard label="Pending resource requests" value={mockResourceRequests.length} helper="Requests from citizens" />
        <StatCard label="Open SOS queue" value={mockSOSSignals.length} helper="Needs rapid triage" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>Today&apos;s operational focus</CardTitle>
          <CardDescription className="mt-2">
            Coordinate field workers around the highest-impact incident zone.
          </CardDescription>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="font-medium text-white">{mockDisasters[0].title}</p>
            <p className="mt-2 text-sm text-muted">{mockDisasters[0].description}</p>
          </div>
        </Card>

        <Card>
          <CardTitle>Immediate action items</CardTitle>
          <CardDescription className="mt-2">
            Fastest route to impact during a live emergency.
          </CardDescription>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Confirm water pack stock and dispatch low inventory depots.</li>
            <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Review incoming SOS cases and assign nearest available responders.</li>
            <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Post field update for blocked roads and newly opened shelters.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
