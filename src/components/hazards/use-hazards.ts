"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getHazardSnapshot, hazardRequest } from "@/lib/hazards/client";
import type { GeoPoint, HazardRole, HazardSnapshot } from "@/lib/hazards/types";

export function useHazards(role: HazardRole, point?: GeoPoint | null, demoProfile?: string) {
  const [snapshot, setSnapshot] = useState<HazardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const active = useRef(false);
  const latestRequest = useRef(0);
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const data = await getHazardSnapshot(role, latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined, demoProfile);
      if (!active.current || request !== latestRequest.current) return;
      setSnapshot(data);
      setError(null);
    } catch (cause) {
      if (active.current && request === latestRequest.current) setError(cause instanceof Error ? cause.message : "Unable to refresh cases. Try again.");
    } finally {
      if (active.current && request === latestRequest.current) setLoading(false);
    }
  }, [role, latitude, longitude, demoProfile]);

  useEffect(() => {
    active.current = true;
    setSnapshot(null);
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { active.current = false; ++latestRequest.current; window.clearInterval(timer); };
  }, [refresh]);
  return { snapshot, error, loading, refresh };
}

export type RunHazardAction = (action: string, input: Record<string, unknown>, success: string) => Promise<boolean>;

export function useHazardActions(role: HazardRole, refresh: () => Promise<void>, demoProfile?: string) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const run: RunHazardAction = async (action, input, success) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError(null); setMessage(null);
    try {
      await hazardRequest(action, input, role, demoProfile);
      setMessage(success);
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The change could not be saved. Please try again.");
      return false;
    } finally { pending.current = false; setBusy(false); }
  };
  return { run, busy, error, message };
}
