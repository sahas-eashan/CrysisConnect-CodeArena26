"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { NotificationBell } from "@/components/shared/notification-bell";

export function Navbar({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(8,14,25,0.94),rgba(8,14,25,0.82))] px-6 py-4 backdrop-blur-xl">
      <div>
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-sky-200">
          Live operations
        </div>
        <h1 className="mt-3 text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <Link
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition hover:border-danger/30 hover:bg-danger/10"
          href="/api/auth/logout"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </header>
  );
}
