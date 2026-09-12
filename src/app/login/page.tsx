"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

const roleRedirects: Record<string, string> = {
  citizen: "/citizen/dashboard",
  ngo: "/ngo/dashboard",
  government: "/admin/dashboard"
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const role = String(form.get("role") || "citizen");

    try {
      await login(email, password);
      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });
      router.push(roleRedirects[role] ?? "/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardTitle>Sign in to CrisisConnect</CardTitle>
        <CardDescription className="mt-2">
          Use Cognito credentials when AWS is configured. Without env vars, the app runs in demo mode.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="email" placeholder="Email or phone" required />
          <Input name="password" placeholder="Password" required type="password" />
          <select className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm" name="role">
            <option value="citizen">Citizen</option>
            <option value="ngo">NGO / Field worker</option>
            <option value="government">Government admin</option>
          </select>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Need an account?{" "}
          <Link className="text-primary" href="/register">
            Register here
          </Link>
        </p>
      </Card>
    </main>
  );
}
