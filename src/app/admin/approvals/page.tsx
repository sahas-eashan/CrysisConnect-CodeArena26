"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mockOrganizations } from "@/lib/mock-data";

export default function AdminApprovalsPage() {
  const [status, setStatus] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>NGO and organization approvals</CardTitle>
        <CardDescription className="mt-2">
          Large organizations require government review before they can manage shared operational resources.
        </CardDescription>
        <div className="mt-6 space-y-4">
          {mockOrganizations.map((organization) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={organization.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{organization.name}</p>
                  <p className="mt-1 text-sm text-muted">{organization.description}</p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  {status[organization.id] ?? organization.approvalStatus}
                </span>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={() => setStatus((current) => ({ ...current, [organization.id]: "approved" }))}>
                  Approve
                </Button>
                <Button
                  onClick={() => setStatus((current) => ({ ...current, [organization.id]: "rejected" }))}
                  variant="outline"
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
