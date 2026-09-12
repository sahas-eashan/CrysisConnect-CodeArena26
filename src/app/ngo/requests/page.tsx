"use client";

import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import { mockResourceRequests, mockResources } from "@/lib/mock-data";
import type { Resource, ResourceRequest } from "@/lib/types";

function sortRequests(requests: ResourceRequest[]) {
  const priorityWeight: Record<string, number> = {
    critical: 0,
    high: 1,
    urgent: 1,
    normal: 2,
    medium: 3,
    low: 4
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
  const [resources, setResources] = useState<Resource[]>(() => (hasAwsConfig ? [] : mockResources));
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
        const [requestsResult, resourcesResult] = await Promise.allSettled([
          client.graphql({
            query: queries.getResourceRequests,
            authMode: "userPool",
            variables: { status: "pending" }
          }),
          client.graphql({
            query: queries.getResources,
            authMode: "userPool"
          })
        ]);

        if (!active) return;

        if (requestsResult.status === "fulfilled") {
          const nextRequests = ((requestsResult.value as any).data?.getResourceRequests ?? []) as ResourceRequest[];
          setRequests(sortRequests(nextRequests));
        } else {
          setRequests([]);
        }

        if (resourcesResult.status === "fulfilled") {
          const nextResources = ((resourcesResult.value as any).data?.getResources ?? []) as Resource[];
          setResources(nextResources);
        } else {
          setResources([]);
        }

        if (requestsResult.status === "rejected") {
          const nextError =
            requestsResult.reason instanceof Error
              ? requestsResult.reason.message
              : "Unable to load citizen requests.";
          setError(
            nextError.includes("Unauthorized")
              ? "This Cognito account is not in the NGO or government group, so live citizen requests cannot be loaded here."
              : nextError
          );
        } else if (resourcesResult.status === "rejected") {
          setError(
            resourcesResult.reason instanceof Error
              ? resourcesResult.reason.message
              : "Unable to load current resource inventory."
          );
        }
      } catch (loadError) {
        if (!active) return;

        setRequests([]);
        setResources([]);
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

  const resourceLookup = useMemo(() => {
    const byId = new Map<string, Resource>();
    const byName = new Map<string, Resource>();

    resources.forEach((resource) => {
      byId.set(resource.id, resource);
      byName.set(resource.name.trim().toLowerCase(), resource);
    });

    return { byId, byName };
  }, [resources]);

  async function onFulfill(id: string) {
    const request = requests.find((item) => item.id === id);
    const matchingResource =
      (request?.resourceId ? resourceLookup.byId.get(request.resourceId) : undefined) ??
      (request?.resourceName ? resourceLookup.byName.get(request.resourceName.trim().toLowerCase()) : undefined);
    const availableAmount = Math.max(0, Number(matchingResource?.quantity ?? 0));
    const requestedAmount = Math.max(0, Number(request?.quantityNeeded ?? 0));

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

      const refreshedResources = await client.graphql({
        query: queries.getResources,
        authMode: "userPool"
      });
      setResources((((refreshedResources as any).data?.getResources ?? []) as Resource[]));

      if (!matchingResource) {
        setMessage("Warning: no resources available in inventory. Request marked as fulfilled.");
      } else if (availableAmount >= requestedAmount) {
        setMessage("Request marked as fulfilled and inventory updated.");
      } else {
        setMessage(
          `Inventory exhausted. Remaining request amount: ${updatedRequest?.quantityNeeded ?? Math.max(requestedAmount - availableAmount, 0)}.`
        );
      }
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
          {pendingRequests.map((request) => {
            const matchingResource =
              (request.resourceId ? resourceLookup.byId.get(request.resourceId) : undefined) ??
              (request.resourceName ? resourceLookup.byName.get(request.resourceName.trim().toLowerCase()) : undefined);

            return (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={request.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{request.resourceName ?? "Unnamed request"}</p>
                    <p className="mt-1 text-sm text-muted">
                      Needs {request.quantityNeeded ?? 0} • {(request.urgency ?? "normal").toLowerCase()} priority
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Available now</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {matchingResource
                        ? `${matchingResource.quantity ?? 0} ${matchingResource.unit ?? "units"}`
                        : "Not found"}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Button disabled={fulfillingId === request.id} onClick={() => void onFulfill(request.id)}>
                    {fulfillingId === request.id ? "Saving..." : "Mark as fulfilled"}
                  </Button>
                </div>
              </div>
            );
          })}
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
