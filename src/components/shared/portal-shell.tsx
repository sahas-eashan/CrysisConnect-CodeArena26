import { Navbar } from "@/components/shared/navbar";
import { Sidebar } from "@/components/shared/sidebar";

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
      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar subtitle={subtitle} title={title} />
        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
