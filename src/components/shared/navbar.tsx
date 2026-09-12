"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "aws-amplify/auth";

import { NotificationBell } from "@/components/shared/notification-bell";

export function Navbar({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setSigningOut(true); setError(null);
    try {
      if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) await signOut();
      window.location.assign("/api/auth/logout");
    } catch { setError("Unable to sign out. Please retry."); setSigningOut(false); }
  }
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(8,14,25,0.94),rgba(8,14,25,0.82))] px-4 py-4 backdrop-blur-xl sm:px-6">
      <div>
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-sky-200">
          Response operations
        </div>
        <h1 className="mt-3 text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <button
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition hover:border-danger/30 hover:bg-danger/10"
          onClick={() => void logout()}
          disabled={signingOut}
          type="button"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
      </div>
    </header>
  );
}
