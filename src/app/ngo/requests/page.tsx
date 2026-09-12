"use client";

import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import { mockResourceRequests } from "@/lib/mock-data";
import type { ResourceRequest } from "@/lib/types";

function sortRequests(requests: ResourceRequest[]) {
  const priorityWeight: Record<string, number> = {
    high: 0,
    urgent: 0,
    medium: 1,
    normal: 2,
    low: 3
  };

  return [...requests].sort((left, right) => {
    const leftPriority = priorityWeight[left.urgency?.toLowerCase() ?? "normal"] ?? 4;
    const rightPriority = priorityWeight[right.urgency?.toLowerCase() ?? "normal"] ?? 4;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  });
}

export default function NgoRequestsPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [requests, setRequests] = useState<ResourceRequest[]>(() => (hasAwsConfig ? [] : mockResourceRequests));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();
    let active = true;

    async function loadRequests() {
      setLoading(true);
      setError(null);

      try {
        const result = await client.graphql({
          query: queries.getResourceRequests,
          authMode: "userPool",
          variables: { status: "pending" }
        });

        if (!active) return;

        const nextRequests = ((result as any).data?.getResourceRequests ?? []) as ResourceRequest[];
        setRequests(sortRequests(nextRequests));
      } catch (loadError) {
        if (!active) return;

        setRequests([]);
        const nextError = loadError instanceof Error ? loadError.message : "Unable to load citizen requests.";
        setError(
          nextError.includes("Unauthorized")
            ? "This Cognito account is not in the NGO or government group, so live citizen requests cannot be loaded here."
            : nextError
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRequests();

    const unsubscribeNewRequests = (client.graphql({
      query: subscriptions.onNewResourceRequest,
      authMode: "userPool"
    }) as any).subscribe({
      next: () => {
        void loadRequests();
      },
      error: (subscriptionError: unknown) => console.error("Request subscription error", subscriptionError)
    });

    return () => {
      active = false;
      unsubscribeNewRequests.unsubscribe();
    };
  }, [hasAwsConfig]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => (request.status ?? "pending").toLowerCase() !== "fulfilled"),
    [requests]
  );

  async function onFulfill(id: string) {
    if (!hasAwsConfig) {
      setRequests((current) =>
        current.map((request) => (request.id === id ? { ...request, status: "fulfilled" } : request))
      );
      setMessage("Demo mode: request marked as fulfilled.");
      setError(null);
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setFulfillingId(id);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.fulfillResourceRequest,
        authMode: "userPool",
        variables: { id }
      });

      const updatedRequest = (result as any).data?.fulfillResourceRequest as ResourceRequest | undefined;
      if (updatedRequest) {
        setRequests((current) => sortRequests(current.map((request) => (request.id === id ? updatedRequest : request))));
      }
      setMessage("Request marked as fulfilled.");
    } catch (fulfillError) {
      setError(fulfillError instanceof Error ? fulfillError.message : "Unable to fulfill the request.");
    } finally {
      setFulfillingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Incoming citizen requests</CardTitle>
        <CardDescription className="mt-2">
          Review and fulfill live pending requests submitted by citizens.
        </CardDescription>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="mt-6 space-y-3">
          {pendingRequests.map((request) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={request.id}>
              <p className="font-medium text-white">{request.resourceName ?? "Unnamed request"}</p>
              <p className="mt-1 text-sm text-muted">
                Needs {request.quantityNeeded ?? 0} • {(request.urgency ?? "normal").toLowerCase()} priority
              </p>
              <div className="mt-3">
                <Button disabled={fulfillingId === request.id} onClick={() => void onFulfill(request.id)}>
                  {fulfillingId === request.id ? "Saving..." : "Mark as fulfilled"}
                </Button>
              </div>
            </div>
          ))}
          {!pendingRequests.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No pending citizen requests right now.
            </div>
          ) : null}
        </div>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>
    </div>
  );
}
