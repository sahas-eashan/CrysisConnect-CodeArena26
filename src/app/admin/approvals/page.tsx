"use client";

import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import type { Organization } from "@/lib/types";
import { cn } from "@/lib/utils";

function sortOrganizations(organizations: Organization[]) {
  const statusOrder: Record<string, number> = {
    pending: 0,
    under_review: 1,
    approved: 2,
    rejected: 3
  };

  return [...organizations].sort((left, right) => {
    const leftWeight = statusOrder[left.approvalStatus?.toLowerCase() ?? "pending"] ?? 4;
    const rightWeight = statusOrder[right.approvalStatus?.toLowerCase() ?? "pending"] ?? 4;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

function statusClassName(status?: string | null) {
  switch ((status ?? "").toLowerCase()) {
    case "approved":
      return "border border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    case "rejected":
      return "border border-red-400/30 bg-red-500/15 text-red-200";
    case "under_review":
      return "border border-sky-400/30 bg-sky-500/15 text-sky-100";
    default:
      return "border border-amber-400/30 bg-amber-500/15 text-amber-100";
  }
}

export default function AdminApprovalsPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadOrganizations() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);
        const result = await client.graphql({
          query: queries.getOrganizations,
          authMode: "userPool"
        });

        if (!active) return;

        const nextOrganizations = ((result as any).data?.getOrganizations ?? []) as Organization[];
        setOrganizations(sortOrganizations(nextOrganizations));
      } catch (loadError) {
        if (!active) return;
        setOrganizations([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load partner approvals.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOrganizations();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  const pendingCount = useMemo(
    () => organizations.filter((organization) => (organization.approvalStatus ?? "pending").toLowerCase() === "pending").length,
    [organizations]
  );

  async function onDecision(id: string, approved: boolean) {
    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();

    try {
      setActingId(id);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.approveOrganization,
        authMode: "userPool",
        variables: {
          id,
          approved
        }
      });

      const updatedOrganization = (result as any).data?.approveOrganization as Organization | undefined;
      if (!updatedOrganization?.id) {
        throw new Error("The backend did not return the updated organization approval.");
      }

      setOrganizations((current) =>
        sortOrganizations(
          current.map((organization) => (organization.id === id ? { ...organization, ...updatedOrganization } : organization))
        )
      );
      setMessage(approved ? "Organization approved for live operations." : "Organization approval request rejected.");
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to update organization approval.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Pending review</CardTitle>
          <CardDescription className="mt-2">Organizations waiting for command approval.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{pendingCount}</p>
        </Card>
        <Card className="border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Total partners</CardTitle>
          <CardDescription className="mt-2">All organizations visible to the government role.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{organizations.length}</p>
        </Card>
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Command action</CardTitle>
          <CardDescription className="mt-2">Approve logistics and field partners into the shared network.</CardDescription>
          <p className="mt-6 text-sm text-slate-300">Every decision is written back to the live backend.</p>
        </Card>
      </div>

      <Card className="border-white/10">
        <CardTitle>Partner approvals</CardTitle>
        <CardDescription className="mt-2">
          Review NGO and partner onboarding requests, then approve or reject them for live command operations.
        </CardDescription>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

        <div className="mt-6 space-y-4">
          {organizations.map((organization) => (
            <div
              className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_38%),linear-gradient(180deg,rgba(12,20,36,0.96),rgba(7,12,24,0.95))] p-5"
              key={organization.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold text-white">{organization.name}</p>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium", statusClassName(organization.approvalStatus))}>
                      {(organization.approvalStatus ?? "pending").replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{organization.description ?? "No organization description provided."}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Type: {organization.type ?? "unspecified"}
                    </span>
                    {organization.createdAt ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        Submitted: {new Date(organization.createdAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="rounded-full px-5"
                    disabled={actingId === organization.id}
                    onClick={() => void onDecision(organization.id, true)}
                    variant="success"
                  >
                    {actingId === organization.id ? "Saving..." : "Approve"}
                  </Button>
                  <Button
                    className="rounded-full px-5"
                    disabled={actingId === organization.id}
                    onClick={() => void onDecision(organization.id, false)}
                    variant="danger"
                  >
                    {actingId === organization.id ? "Saving..." : "Reject"}
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {!organizations.length && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-muted">
              No organization approvals are waiting right now.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
