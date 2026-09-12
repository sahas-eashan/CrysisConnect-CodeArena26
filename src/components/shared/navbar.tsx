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
    <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell count={3} />
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-foreground transition hover:bg-slate-900"
          href="/api/auth/logout"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </header>
  );
}
