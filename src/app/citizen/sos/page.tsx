"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";

import { CitizenSosCoach } from "@/components/ai/citizen-sos-coach";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/use-geolocation";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries, subscriptions } from "@/lib/aws/graphql/operations";
import type { SOSSignal } from "@/lib/types";

export default function CitizenSOSPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [signals, setSignals] = useState<SOSSignal[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sosType, setSosType] = useState("medical");
  const [description, setDescription] = useState("");
  const { coordinates, error, loading, requestLocation } = useGeolocation();

  const geoJson = useMemo(() => {
    if (!coordinates) return null;
    return JSON.stringify({
      type: "Point",
      coordinates: [coordinates.longitude, coordinates.latitude]
    });
  }, [coordinates]);

  useEffect(() => {
    if (!hasAwsConfig) return;

    let active = true;
    let inFlight = false;
    let subscription: { unsubscribe: () => void } | undefined;
    configureAmplify();
    const client = generateClient();

    async function loadSignals() {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const result = await client.graphql({ query: queries.getMySOSSignals, authMode: "userPool" });
        if (!active) return;

        setSignals(((result as any).data?.getMySOSSignals ?? []) as SOSSignal[]);
        setStatusError(null);
      } catch (loadError) {
        if (!active) return;
        setStatusError(loadError instanceof Error ? loadError.message : "Unable to refresh your SOS status. Retrying shortly.");
      } finally {
        inFlight = false;
      }
    }

    async function subscribeToStatus() {
      try {
        const user = await getCurrentUser();
        if (!active) return;
        const observable = client.graphql({
          query: subscriptions.onMySOSUpdate,
          variables: { senderId: user.userId },
          authMode: "userPool"
        }) as unknown as {
          subscribe: (observer: { next: (event: { data?: { onMySOSUpdate?: SOSSignal } }) => void; error: () => void }) => { unsubscribe: () => void };
        };
        subscription = observable.subscribe({
          next: ({ data }) => {
            if (!active || !data?.onMySOSUpdate) return;
            const updated = data.onMySOSUpdate;
            setSignals((current) => current.map((signal) => signal.id === updated.id ? { ...signal, ...updated } : signal));
            void loadSignals();
          },
          error: () => {
            if (active) setStatusError("Live status connection interrupted. Status refresh continues every 15 seconds.");
          }
        });
      } catch {
        if (active) setStatusError("Live status connection unavailable. Status refresh continues every 15 seconds.");
      }
    }

    void loadSignals();
    void subscribeToStatus();
    const timer = window.setInterval(() => void loadSignals(), 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
      subscription?.unsubscribe();
    };
  }, [hasAwsConfig]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const type = String(form.get("type") ?? "medical");
    const description = String(form.get("description") ?? "").trim();

    if (!geoJson) {
      setMessage("Capture your location first so the system can route the SOS to the closest responders.");
      return;
    }

    if (!hasAwsConfig) {
      setSubmitError("Live backend is not configured.");
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setSubmitError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.createSOS,
        authMode: "userPool",
        variables: {
          input: {
            location: geoJson,
            type,
            description: description || null
          }
        }
      });

      const createdSignal = (result as any).data?.createSOS as SOSSignal | undefined;
      if (!createdSignal?.id) {
        throw new Error("The backend did not return a saved SOS signal.");
      }

      setSignals((current) => [createdSignal, ...current]);
      formElement.reset();
      setSosType("medical");
      setDescription("");
      setMessage("SOS saved to the real backend and sent for response.");
    } catch (submitErrorValue) {
      setSubmitError(submitErrorValue instanceof Error ? submitErrorValue.message : "Unable to save your SOS.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <div className="space-y-6">
        <CitizenSosCoach
          description={description}
          onApplyRefined={(value) => setDescription(value)}
          type={sosType}
        />

        <Card className="border-danger/30">
        <CardTitle>Emergency SOS</CardTitle>
        <CardDescription className="mt-2">
          One tap to alert nearby responders. Your live coordinates are used for triage and safe-zone routing.
        </CardDescription>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button className="rounded-full px-5 py-2.5 whitespace-nowrap" onClick={requestLocation} variant="danger">
            {loading ? "Capturing location..." : "Capture my location"}
          </Button>
          {coordinates ? (
            <span className="rounded-full bg-success/15 px-3 py-2 text-sm text-green-300">
              {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <select
            className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="type"
            onChange={(event) => setSosType(event.target.value)}
            value={sosType}
          >
            <option value="medical">Medical emergency</option>
            <option value="trapped">Trapped or stranded</option>
            <option value="evacuation">Evacuation needed</option>
            <option value="resources">Urgent essentials needed</option>
          </select>
          <Input
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the situation"
            value={description}
          />
          <Button className="w-full rounded-full" disabled={saving} type="submit" variant="danger">
            {saving ? "Sending..." : "Send SOS"}
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
        {submitError ? <p className="mt-4 text-sm text-danger">{submitError}</p> : null}
        </Card>
      </div>

      <Card>
        <CardTitle>Your SOS signals</CardTitle>
        <CardDescription className="mt-2">Your saved requests update as responders accept and resolve them.</CardDescription>
        {statusError ? <p className="mt-3 text-sm text-amber-300" role="status">{statusError}</p> : null}
        <div className="mt-6 space-y-3">
          {signals.map((signal) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={signal.id}>
              <p className="font-medium text-white">{signal.type}</p>
              <p className="mt-1 text-sm text-muted">{signal.description}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-primary">Status: {signal.status}</p>
              {signal.assignedTo ? <p className="mt-2 text-sm text-muted">A responder has been assigned.</p> : null}
              {signal.resolvedAt ? <p className="mt-2 text-sm text-green-300">Resolved {new Date(signal.resolvedAt).toLocaleString()}</p> : null}
            </div>
          ))}
          {!signals.length ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              You do not have any SOS signals yet.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
