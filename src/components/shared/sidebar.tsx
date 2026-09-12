"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  label: string;
};

export function Sidebar({
  title,
  items
}: {
  title: string;
  items: SidebarItem[];
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(10,18,33,0.98),rgba(5,10,20,0.96))] p-6 shadow-[24px_0_80px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <div>
        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
          CrisisConnect
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted">
          Unified disaster response for citizens, volunteers, and authorities.
        </p>
      </div>
      <nav className="mt-8 space-y-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl px-4 py-3 text-sm transition duration-200",
                active
                  ? "border border-primary/40 bg-gradient-to-r from-primary to-sky-300 text-slate-950 shadow-[0_10px_30px_rgba(56,189,248,0.35)]"
                  : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/12 via-slate-900/90 to-sky-500/12 p-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_14px_rgba(34,197,94,0.8)]" />
          <p className="text-sm font-medium text-foreground">Offline readiness</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          Safe zones, alerts, and queued SOS payloads remain available even when connectivity drops.
        </p>
      </div>
    </aside>
  );
}
