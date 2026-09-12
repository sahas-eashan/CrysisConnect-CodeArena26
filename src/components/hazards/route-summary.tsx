"use client";

import type { SafeRoute } from "@/lib/hazards/types";

export function RouteSummary({ route, automatic = false }: { route: SafeRoute; automatic?: boolean }) {
  return <div className="space-y-2 rounded-xl border border-slate-700 p-3" role="status">
    <p className={`font-medium ${route.status === "available" ? "text-sky-300" : "text-amber-300"}`}>{route.status === "available" ? "Route screened against known hazards" : "No screened route available"}</p>
    {automatic ? <p className="text-xs text-sky-200">Included automatically with this area warning.</p> : null}
    <p className="text-sm">{route.reason}</p>
    {route.shelter ? <p className="text-sm">Destination: {route.shelter.name}</p> : null}
    <p className="text-xs text-muted">{route.distanceM !== undefined ? `${(route.distanceM / 1000).toFixed(1)} km · ` : ""}Checked {new Date(route.checkedAt).toLocaleTimeString()}</p>
    {route.limitations.map((limitation) => <p className="text-xs text-amber-200" key={limitation}>{limitation}</p>)}
  </div>;
}
