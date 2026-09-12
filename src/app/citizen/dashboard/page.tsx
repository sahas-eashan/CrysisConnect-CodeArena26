import Link from "next/link";

import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mockDashboardStats, mockDisasters, mockNews, mockSafeZones } from "@/lib/mock-data";
import { percent } from "@/lib/utils";

export default function CitizenDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard helper="Currently affecting the region." label="Active disasters" value={mockDashboardStats.activeDisasters} />
        <StatCard helper="Responders and government users." label="Connected responders" value={184} />
        <StatCard helper="Live shelter inventory." label="Safe zones" value={mockDashboardStats.totalSafeZones} />
        <StatCard helper="Pending community requests." label="Open aid requests" value={mockDashboardStats.pendingSOS} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardTitle>Nearest safe zones</CardTitle>
          <CardDescription className="mt-2">
            Capacity-aware shelter suggestions that avoid already crowded camps.
          </CardDescription>
          <div className="mt-6 space-y-4">
            {mockSafeZones.map((zone) => (
              <Link
                className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-primary/60 hover:bg-slate-950/70"
                href={`/citizen/map?safeZone=${zone.id}`}
                key={zone.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{zone.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      Amenities: {zone.amenities?.join(", ") ?? "General shelter support"}
                    </p>
                  </div>
                  <Badge>{zone.status}</Badge>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted">
                    <span>Occupancy</span>
                    <span>
                      {zone.currentOccupancy}/{zone.capacity}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-900">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${percent(zone.currentOccupancy, zone.capacity)}%` }}
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs text-primary">Open on live map</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Primary incident</CardTitle>
          <CardDescription className="mt-2">
            Real-time public brief from the command center.
          </CardDescription>
          <div className="mt-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{mockDisasters[0].title}</p>
                <p className="mt-2 text-sm text-slate-200">{mockDisasters[0].description}</p>
              </div>
              <Badge className="border-danger/40 bg-danger/10 text-red-200">{mockDisasters[0].severity}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(mockDisasters[0].secondaryRisks ?? []).map((risk) => (
                <Badge key={risk}>{risk}</Badge>
              ))}
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <p className="text-sm font-medium text-white">Latest public notice</p>
            <p className="mt-2 text-sm text-muted">{mockNews[0].title}</p>
            <p className="mt-3 text-sm text-slate-300">{mockNews[0].content}</p>
          </div>
          <div className="mt-6 flex gap-3">
            <Button>Get me to safety</Button>
            <Link href="/citizen/resources">
              <Button variant="outline">Request essentials</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
