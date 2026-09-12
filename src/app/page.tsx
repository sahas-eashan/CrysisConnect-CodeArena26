import Link from "next/link";
import { Activity, BellRing, MapPinned, ShieldCheck, Siren, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const pillars = [
  {
    icon: BellRing,
    title: "Geofenced early warnings",
    description: "Target citizens near registered disaster polygons with SMS, push, and email."
  },
  {
    icon: MapPinned,
    title: "Safe zone routing",
    description: "Find the nearest shelter with available capacity and navigate people there quickly."
  },
  {
    icon: Siren,
    title: "SOS triage",
    description: "Match emergency signals to nearby responders and stream status live across portals."
  },
  {
    icon: Users,
    title: "Coordinated response",
    description: "Citizens, NGOs, and government teams collaborate in one shared operating picture."
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge className="border-primary/40 bg-primary/10 text-primary">Disaster response platform</Badge>
            <h1 className="mt-4 text-5xl font-bold tracking-tight text-white">CrisisConnect</h1>
            <p className="mt-3 max-w-3xl text-lg text-slate-300">
              A single AWS-native disaster management platform for early warnings, rescue coordination,
              safe-zone routing, resource allocation, and resilient community communication.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/citizen/dashboard">
              <Button>Citizen Portal</Button>
            </Link>
            <Link href="/ngo/dashboard">
              <Button variant="outline">NGO Portal</Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="secondary">Government Portal</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <Icon className="h-8 w-8 text-primary" />
              <CardTitle className="mt-4">{title}</CardTitle>
              <CardDescription className="mt-2">{description}</CardDescription>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <Card className="overflow-hidden">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-primary">Why it stands out</p>
                  <h2 className="mt-2 text-3xl font-semibold">Designed for real emergencies, not dashboards alone</h2>
                </div>
                <ShieldCheck className="h-10 w-10 text-success" />
              </div>
              <ul className="mt-6 space-y-4 text-sm text-slate-300">
                <li>Built on AWS with Terraform so every resource can be recreated or destroyed cleanly.</li>
                <li>Uses PostGIS for disaster polygons, geofenced alerts, safe-zone capacity routing, and responder matching.</li>
                <li>Supports citizens, volunteers, NGOs, and government teams in one shared workflow.</li>
                <li>Includes offline-safe UX patterns for queued SOS submission and cached emergency data.</li>
              </ul>
            </div>
          </Card>

          <Card>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Demo story
            </CardTitle>
            <CardDescription className="mt-2">
              Government registers a Colombo flood, citizens receive alerts, responders pick up SOS calls,
              and resources are allocated from one command view.
            </CardDescription>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">1. Create disaster polygon</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">2. Broadcast geofenced alert</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">3. Citizen sends SOS</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">4. NGO accepts dispatch and allocates aid</div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
