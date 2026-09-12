import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mockResources } from "@/lib/mock-data";

export default function AdminResourcesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Cross-agency resource overview</CardTitle>
        <CardDescription className="mt-2">
          Monitor stock levels across NGOs and field teams, then redirect supply where shortages are emerging.
        </CardDescription>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {mockResources.map((resource) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={resource.id}>
              <p className="font-medium text-white">{resource.name}</p>
              <p className="mt-1 text-sm text-muted">
                {resource.quantity} {resource.unit} • {resource.category}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wide text-primary">Status: {resource.status}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
