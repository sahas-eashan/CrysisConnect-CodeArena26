"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import type { SafeZone } from "@/lib/types";

type SafeZoneFormState = {
  name: string;
  capacity: string;
  currentOccupancy: string;
  amenities: string;
  location: string;
};

const defaultForm: SafeZoneFormState = {
  name: "",
  capacity: "",
  currentOccupancy: "",
  amenities: "",
  location: ""
};

function normalizeLocationInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  JSON.parse(trimmed);
  return trimmed;
}

export default function AdminSafeZonesPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [form, setForm] = useState<SafeZoneFormState>(defaultForm);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAwsConfig) {
      setError("Live backend is not configured.");
      return;
    }

    let active = true;

    async function loadZones() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);
        const result = await client.graphql({
          query: queries.getSafeZones,
          authMode: "userPool"
        });

        if (!active) return;

        setZones(((result as any).data?.getSafeZones ?? []) as SafeZone[]);
      } catch (loadError) {
        if (!active) return;
        setZones([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load live safe zones.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadZones();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  const occupancyPressure = useMemo(
    () =>
      zones.filter((zone) => zone.capacity > 0 && zone.currentOccupancy / zone.capacity >= 0.8).length,
    [zones]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasAwsConfig) return;

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const capacity = Number(form.capacity);
      const currentOccupancy = Number(form.currentOccupancy);
      const location = normalizeLocationInput(form.location);

      const createResult = await client.graphql({
        query: mutations.createSafeZone,
        authMode: "userPool",
        variables: {
          input: {
            name: form.name.trim(),
            capacity: Number.isFinite(capacity) ? capacity : 0,
            amenities: form.amenities
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            location
          }
        }
      });

      let createdZone = (createResult as any).data?.createSafeZone as SafeZone | undefined;
      if (!createdZone?.id) {
        throw new Error("The backend did not return the saved safe zone.");
      }

      if (Number.isFinite(currentOccupancy) && currentOccupancy > 0) {
        const occupancyResult = await client.graphql({
          query: mutations.updateSafeZoneOccupancy,
          authMode: "userPool",
          variables: {
            id: createdZone.id,
            delta: currentOccupancy
          }
        });

        createdZone = ((occupancyResult as any).data?.updateSafeZoneOccupancy ?? createdZone) as SafeZone;
      }

      setZones((current) => [createdZone, ...current]);
      setForm(defaultForm);
      setMessage("Safe zone saved to the live routing backend.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save the safe zone.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Total shelters</CardTitle>
          <CardDescription className="mt-2">Live shelters available for government routing.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{zones.length}</p>
        </Card>
        <Card className="border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-slate-950/90 to-transparent">
          <CardTitle>Total capacity</CardTitle>
          <CardDescription className="mt-2">Combined shelter capacity across all tracked safe zones.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{zones.reduce((sum, zone) => sum + zone.capacity, 0)}</p>
        </Card>
        <Card className="border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-slate-950/90 to-transparent">
          <CardTitle>High pressure shelters</CardTitle>
          <CardDescription className="mt-2">Safe zones above 80% occupancy.</CardDescription>
          <p className="mt-6 text-4xl font-semibold text-white">{occupancyPressure}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardTitle>Active safe zones</CardTitle>
          <CardDescription className="mt-2">Government-managed shelters with live capacity visibility.</CardDescription>
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <div className="mt-6 space-y-4">
            {zones.map((zone) => {
              const occupancyRate = zone.capacity ? Math.min(100, Math.round((zone.currentOccupancy / zone.capacity) * 100)) : 0;
              return (
                <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4" key={zone.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-white">{zone.name}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {zone.currentOccupancy}/{zone.capacity} occupied
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                      {zone.status ?? "active"}
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className={`h-full rounded-full ${occupancyRate >= 80 ? "bg-red-400" : occupancyRate >= 60 ? "bg-amber-300" : "bg-emerald-400"}`}
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!zones.length && !loading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-muted">
                No live safe zones are currently registered.
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardTitle>Create safe zone</CardTitle>
          <CardDescription className="mt-2">Set shelter capacity, amenities, and live map location for routing.</CardDescription>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input
              name="name"
              placeholder="Safe zone name"
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              min={1}
              name="capacity"
              placeholder="Capacity"
              required
              type="number"
              value={form.capacity}
              onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
            />
            <Input
              min={0}
              name="currentOccupancy"
              placeholder="Current occupancy"
              type="number"
              value={form.currentOccupancy}
              onChange={(event) => setForm((current) => ({ ...current, currentOccupancy: event.target.value }))}
            />
            <Input
              name="amenities"
              placeholder="Amenities (comma separated)"
              value={form.amenities}
              onChange={(event) => setForm((current) => ({ ...current, amenities: event.target.value }))}
            />
            <Input
              name="location"
              placeholder='GeoJSON Point, e.g. {"type":"Point","coordinates":[79.87,6.93]}'
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
            <Button className="w-full rounded-full" disabled={saving} type="submit" variant="success">
              {saving ? "Saving..." : "Save safe zone"}
            </Button>
          </form>
          {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
        </Card>
      </div>
    </div>
  );
}
