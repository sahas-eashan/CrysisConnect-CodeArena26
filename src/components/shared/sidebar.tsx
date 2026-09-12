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
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-950/80 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">CrisisConnect</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">{title}</h2>
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
                "block rounded-xl px-4 py-3 text-sm transition",
                active
                  ? "bg-primary text-slate-950"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-800 bg-card p-4">
        <p className="text-sm font-medium text-foreground">Offline readiness</p>
        <p className="mt-1 text-xs text-muted">
          Safe zones, alerts, and queued SOS payloads remain available even when connectivity drops.
        </p>
      </div>
    </aside>
  );
}
