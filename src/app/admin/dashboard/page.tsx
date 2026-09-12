import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mockDashboardStats, mockDisasters } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active disasters" value={mockDashboardStats.activeDisasters} helper="Live incidents under command" />
        <StatCard label="Pending SOS" value={mockDashboardStats.pendingSOS} helper="Needs responder allocation" />
        <StatCard label="Tracked resources" value={mockDashboardStats.totalResources} helper="Cross-agency inventory" />
        <StatCard label="Safe zones" value={mockDashboardStats.totalSafeZones} helper="Shelters with capacity data" />
        <StatCard label="Registered users" value={mockDashboardStats.totalUsers} helper="Citizens, NGOs, and admins" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardTitle>Command priorities</CardTitle>
          <CardDescription className="mt-2">
            What the government control room needs to act on right now.
          </CardDescription>
          <div className="mt-6 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">Review new NGO approval requests and onboard verified logistics partners.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">Push contamination advisories to citizens within the active flood polygon.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">Reallocate medical kits to the highest SOS density cluster.</div>
          </div>
        </Card>

        <Card>
          <CardTitle>Current primary disaster</CardTitle>
          <CardDescription className="mt-2">{mockDisasters[0].title}</CardDescription>
          <p className="mt-4 text-sm text-slate-300">{mockDisasters[0].description}</p>
        </Card>
      </div>
    </div>
  );
}
