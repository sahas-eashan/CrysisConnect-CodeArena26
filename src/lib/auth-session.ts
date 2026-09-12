"use client";

import { fetchAuthSession } from "aws-amplify/auth";

export async function persistVerifiedSession() {
  const headers: Record<string, string> = {};
  if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
    const token = (await fetchAuthSession()).tokens?.idToken?.toString();
    if (!token) throw new Error("Sign in before opening a portal.");
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch("/api/auth/session", { method: "POST", headers });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to save your session.");
}
