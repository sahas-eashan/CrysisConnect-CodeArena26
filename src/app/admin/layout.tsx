import { PortalShell } from "@/components/shared/portal-shell";

const items = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/disasters", label: "Disasters" },
  { href: "/admin/safe-zones", label: "Safe Zones" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/resources", label: "Resources" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/analytics", label: "Analytics" }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      items={items}
      subtitle="Register disasters, direct resources, approve partners, and broadcast alerts."
      title="Government Portal"
    >
      {children}
    </PortalShell>
  );
}
