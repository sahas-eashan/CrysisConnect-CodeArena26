import { PortalShell } from "@/components/shared/portal-shell";

export default function ReliefLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell title="Relief Coordinator Portal" subtitle="Coordinate assistance and reserve available shelter places for affected households."
    items={[{ href: "/relief/hazards", label: "Relief and shelters" }, { href: "/public-map", label: "Public hazard map" }]}>{children}</PortalShell>;
}
