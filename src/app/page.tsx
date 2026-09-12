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
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <Badge className="border-primary/40 bg-primary/10 text-primary">Disaster response platform</Badge>
            <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-white lg:text-6xl">
              CrisisConnect
              <span className="block bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
                Disaster response with live AI command support
              </span>
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              A single AWS-native disaster management platform for early warnings, rescue coordination,
              safe-zone routing, resource allocation, and resilient community communication.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/citizen/dashboard">
                <Button>Citizen Portal</Button>
              </Link>
              <Link href="/ngo/dashboard">
                <Button variant="success">NGO Portal</Button>
              </Link>
              <Link href="/admin/dashboard">
                <Button variant="secondary">Government Portal</Button>
              </Link>
            </div>
          </div>

          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-sky-500/16 via-slate-950/90 to-emerald-500/14">
            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-sky-200">Live command pulse</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-danger/15 p-4">
                    <p className="text-xs uppercase tracking-wide text-red-200">Critical alerts</p>
                    <p className="mt-2 text-3xl font-semibold text-white">03</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/15 p-4">
                    <p className="text-xs uppercase tracking-wide text-yellow-200">Queued dispatches</p>
                    <p className="mt-2 text-3xl font-semibold text-white">11</p>
                  </div>
                  <div className="rounded-2xl bg-success/15 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-200">Safe shelters</p>
                    <p className="mt-2 text-3xl font-semibold text-white">18</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-medium text-white">Hackathon-ready story</p>
                <div className="mt-4 space-y-3 text-sm text-slate-200">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Government registers a flood and drafts an AI-reviewed alert.</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Citizens receive guidance in English, Sinhala, and Tamil.</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">NGOs triage SOS requests and allocate resources from one live queue.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map(({ icon: Icon, title, description }) => (
            <Card className="border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-sky-950/40" key={title}>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="mt-4">{title}</CardTitle>
              <CardDescription className="mt-2">{description}</CardDescription>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-cyan-950/35">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
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

          <Card className="border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-emerald-950/35">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Demo story
            </CardTitle>
            <CardDescription className="mt-2">
              Government registers a Colombo flood, citizens receive alerts, responders pick up SOS calls,
              and resources are allocated from one command view.
            </CardDescription>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">1. Create disaster polygon</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">2. Broadcast geofenced alert</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">3. Citizen sends SOS</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">4. NGO accepts dispatch and allocates aid</div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
