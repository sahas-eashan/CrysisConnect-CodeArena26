import { Navbar } from "@/components/shared/navbar";
import { Sidebar } from "@/components/shared/sidebar";
import Link from "next/link";

export function PortalShell({
  title,
  subtitle,
  items,
  children
}: {
  title: string;
  subtitle: string;
  items: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar items={items} title={title} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Navbar subtitle={subtitle} title={title} />
        <nav aria-label={`${title} navigation`} className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 lg:hidden">
          {items.map((item) => <Link className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100" key={item.href} href={item.href}>{item.label}</Link>)}
        </nav>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
