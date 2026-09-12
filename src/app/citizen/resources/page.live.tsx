"use client";

import { FormEvent, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import { mockResourceRequests, mockResources } from "@/lib/mock-data";
import type { Resource, ResourceRequest } from "@/lib/types";

export default function CitizenResourcesPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [resources, setResources] = useState<Resource[]>(() => (hasAwsConfig ? [] : mockResources));
  const [requests, setRequests] = useState<ResourceRequest[]>(() => (hasAwsConfig ? [] : mockResourceRequests));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [saving, setSaving] = useState(false);
  const [selectedResourceName, setSelectedResourceName] = useState("");
  const [customResourceName, setCustomResourceName] = useState("");
  const resourceOptions = Array.from(
    new Map(
      resources
        .filter((resource) => resource.name.trim())
        .map((resource) => [resource.name.trim().toLowerCase(), resource])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name));
  const isOtherResource = selectedResourceName === "__other__";

  useEffect(() => {
    if (!hasAwsConfig) return;

    let active = true;

    async function loadData() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);

        const [resourcesResult, requestsResult] = await Promise.allSettled([
          client.graphql({ query: queries.getResources, authMode: "userPool" }),
          client.graphql({ query: queries.getMyResourceRequests, authMode: "userPool" })
        ]);
        if (!active) return;

        if (resourcesResult.status === "fulfilled") {
          setResources(((resourcesResult.value as any).data?.getResources ?? []) as Resource[]);
        } else {
          setResources([]);
        }

        if (requestsResult.status === "fulfilled") {
          setRequests(((requestsResult.value as any).data?.getMyResourceRequests ?? []) as ResourceRequest[]);
        } else {
          setRequests([]);
          setError(
            requestsResult.reason instanceof Error
              ? requestsResult.reason.message
              : "Unable to load your current requests from the backend."
          );
        }
      } catch (loadError) {
        if (!active) return;

        setResources([]);
        setRequests([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load resources from the backend.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const resourceName = (isOtherResource ? customResourceName : selectedResourceName).trim();
    const quantity = Number(form.get("quantity"));
    const urgency = String(form.get("urgency") ?? "normal");
    const matchedResource = resources.find((resource) => resource.name.trim().toLowerCase() === resourceName.toLowerCase());

    if (!resourceName) {
      setError("Choose an available essential or select Other and enter a custom resource name.");
      setMessage(null);
      return;
    }

    if (!hasAwsConfig) {
      setMessage("Demo mode: resource request prepared locally. Connect AWS to save it in the backend.");
      setError(null);
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.requestResource,
        authMode: "userPool",
        variables: {
          input: {
            resourceId: matchedResource?.id ?? null,
            resourceName,
            quantityNeeded: Number.isFinite(quantity) ? quantity : null,
            urgency
          }
        }
      });

      const createdRequest = (result as any).data?.requestResource;
      if (!createdRequest?.id) {
        throw new Error("The backend did not return a saved resource request record.");
      }

      setRequests((current) => [createdRequest as ResourceRequest, ...current]);
      formElement.reset();
      setSelectedResourceName("");
      setCustomResourceName("");
      setMessage(`Resource request saved to the real backend. Request ID: ${createdRequest.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save the resource request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardTitle>Available essentials</CardTitle>
        <CardDescription className="mt-2">
          Browse current inventory fetched from the backend database.
        </CardDescription>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="mt-6 space-y-3">
          {resources.map((resource) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={resource.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{resource.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {resource.category ?? "uncategorized"} | {resource.quantity ?? 0} {resource.unit ?? "units"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  {resource.status ?? "unknown"}
                </span>
              </div>
            </div>
          ))}
          {!resources.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No live resources were returned from the database.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardTitle>Request resources</CardTitle>
        <CardDescription className="mt-2">
          Ask for an existing item or request something that is not yet available in inventory.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="resource-name">
              Needed item
            </label>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-white outline-none transition focus:border-primary"
              id="resource-name"
              required
              value={selectedResourceName}
              onChange={(event) => {
                setSelectedResourceName(event.target.value);
                if (event.target.value !== "__other__") {
                  setCustomResourceName("");
                }
              }}
            >
              <option disabled hidden value="">
                Select a resource
              </option>
              {resourceOptions.map((resource) => (
                <option key={resource.id} value={resource.name}>
                  {resource.name}
                </option>
              ))}
              <option value="__other__">Other</option>
            </select>
          </div>
          {isOtherResource ? (
            <Input
              name="customResourceName"
              placeholder="Type custom resource name"
              required
              value={customResourceName}
              onChange={(event) => setCustomResourceName(event.target.value)}
            />
          ) : null}
          <Input min={1} name="quantity" placeholder="Quantity needed" required type="number" />
          <select className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm" name="urgency">
            <option value="normal">Normal urgency</option>
            <option value="high">High urgency</option>
            <option value="critical">Critical urgency</option>
          </select>
          <Button className="w-full" disabled={saving} type="submit">
            {saving ? "Saving..." : "Submit resource request"}
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

        <div className="mt-8">
          <p className="text-sm font-medium text-white">My requests</p>
          <div className="mt-3 space-y-3">
            {requests.map((request) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={request.id}>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-white">{request.resourceName ?? "Unnamed request"}</p>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">
                    {request.status ?? "pending"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {request.quantityNeeded ?? 0} units | {request.urgency ?? "normal"} priority
                </p>
              </div>
            ))}
            {!requests.length && !loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
                You do not have any saved requests yet.
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
