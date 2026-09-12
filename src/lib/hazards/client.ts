"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/aws/amplify";
import type { GeoPoint, HazardRole, HazardSnapshot } from "./types";

async function headersFor(role: HazardRole, demoProfile?: string): Promise<Record<string, string>> {
  if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) return { "x-demo-role": role, ...(demoProfile ? { "x-demo-profile": demoProfile } : {}) };
  configureAmplify();
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (!token) throw new Error("Please sign in to access the hazard workflow.");
  return { Authorization: `Bearer ${token}` };
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? `Request failed (${response.status}). Please retry.`);
  if (result === null) throw new Error("The server returned an empty response.");
  return result as T;
}

export async function getHazardSnapshot(role: HazardRole = "citizen", point?: GeoPoint, demoProfile?: string): Promise<HazardSnapshot> {
  const query = point ? `?lat=${encodeURIComponent(point.latitude)}&lon=${encodeURIComponent(point.longitude)}` : "";
  return readResponse(await fetch(`/api/hazards${query}`, { headers: await headersFor(role, demoProfile), cache: "no-store" }));
}

export async function hazardRequest<T>(action: string, input: unknown = {}, role: HazardRole = "citizen", demoProfile?: string): Promise<T> {
  return readResponse(await fetch("/api/hazards", {
    method: "POST",
    headers: { ...(await headersFor(role, demoProfile)), "Content-Type": "application/json" },
    body: JSON.stringify({ action, input })
  }));
}
