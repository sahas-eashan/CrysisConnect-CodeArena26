"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

const roleRedirects: Record<string, string> = {
  citizen: "/citizen/dashboard",
  ngo: "/ngo/dashboard",
  government: "/admin/dashboard"
};

function roleFromGroups(groups: string[]) {
  if (groups.includes("government")) return "government";
  if (groups.includes("ngo")) return "ngo";
  return "citizen";
}

export default function LoginPage() {
  const router = useRouter();
  const { completeNewPassword, groups, isReady, login, logout, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signIn" | "newPassword">("signIn");
  const [loading, setLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState("citizen");
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID);
  const signedInRole = roleFromGroups(groups);

  async function continueAsSignedInUser() {
    const role = hasAwsConfig ? signedInRole : pendingRole;

    await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role })
    });

    router.push(roleRedirects[role] ?? "/");
  }

  async function signOutCurrentUser() {
    setLoading(true);
    setError(null);

    try {
      await logout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to sign out the current user.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const fallbackRole = String(form.get("role") || pendingRole || "citizen");

    try {
      if (mode === "newPassword") {
        const newPassword = String(form.get("newPassword"));
        await completeNewPassword(newPassword);
      } else {
        const email = String(form.get("email"));
        const password = String(form.get("password"));
        const result = await login(email, password);

        if (result.status === "newPasswordRequired") {
          setPendingRole(fallbackRole);
          setMode("newPassword");
          setError(
            "This Cognito user was created with a temporary password. Set a new password to finish the first login."
          );
          return;
        }
      }

      let role = fallbackRole;
      if (hasAwsConfig) {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.idToken?.payload["cognito:groups"] as string[] | undefined) ?? [];
        role = roleFromGroups(groups);
      }

      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });
      router.push(roleRedirects[role] ?? "/");
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : "Unable to sign in.";
      setError(
        nextError.includes("already a signed in user")
          ? "A Cognito user is already signed in on this browser. Continue with that account or sign out first."
          : nextError
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardTitle>Sign in to CrisisConnect</CardTitle>
        <CardDescription className="mt-2">
          {mode === "newPassword"
            ? "Cognito requires a one-time password change before this account can finish signing in."
            : "Use Cognito credentials when AWS is configured. Without env vars, the app runs in demo mode."}
        </CardDescription>
        {hasAwsConfig && isReady && user ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-medium">Already signed in</p>
            <p className="mt-1">
              Current Cognito session: {user}. Portal access will use the role detected from this account.
            </p>
            <div className="mt-4 flex gap-3">
              <Button disabled={loading} onClick={() => void continueAsSignedInUser()} type="button">
                Continue
              </Button>
              <Button disabled={loading} onClick={() => void signOutCurrentUser()} type="button" variant="outline">
                Sign out first
              </Button>
            </div>
          </div>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "newPassword" ? (
            <Input name="newPassword" placeholder="Set a new password" required type="password" />
          ) : (
            <>
              <Input name="email" placeholder="Email or phone" required />
              <Input name="password" placeholder="Password" required type="password" />
              {hasAwsConfig ? (
                <p className="rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-muted">
                  Portal access is determined from your actual Cognito group membership after sign-in.
                </p>
              ) : (
                <select
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
                  defaultValue={pendingRole}
                  name="role"
                  onChange={(event) => setPendingRole(event.target.value)}
                >
                  <option value="citizen">Citizen</option>
                  <option value="ngo">NGO / Field worker</option>
                  <option value="government">Government admin</option>
                </select>
              )}
            </>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Signing in..." : mode === "newPassword" ? "Save new password" : "Sign in"}
          </Button>
        </form>
        {mode === "newPassword" ? (
          <button
            className="mt-4 text-sm text-primary"
            onClick={() => {
              setError(null);
              setMode("signIn");
            }}
            type="button"
          >
            Back to sign in
          </button>
        ) : null}
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
