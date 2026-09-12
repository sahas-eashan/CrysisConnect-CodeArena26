export { default } from "./page.live"; /*

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockResourceRequests, mockResources } from "@/lib/mock-data";

export default function CitizenResourcesPage() {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Resource request queued. In live mode this mutation will be sent to AppSync and visible to NGO teams immediately.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardTitle>Available essentials</CardTitle>
        <CardDescription className="mt-2">
          Browse current inventory published by NGOs and field teams.
        </CardDescription>
        <div className="mt-6 space-y-3">
          {mockResources.map((resource) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={resource.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{resource.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {resource.category} • {resource.quantity} {resource.unit}
                  </p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">{resource.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Request resources</CardTitle>
        <CardDescription className="mt-2">
          Ask for an existing item or request something that is not yet available in inventory.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="resourceName" placeholder="Needed item" required />
          <Input min={1} name="quantity" placeholder="Quantity needed" required type="number" />
          <select className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm" name="urgency">
            <option value="normal">Normal urgency</option>
            <option value="high">High urgency</option>
            <option value="critical">Critical urgency</option>
          </select>
          <Button className="w-full" type="submit">
            Submit resource request
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}

        <div className="mt-8">
          <p className="text-sm font-medium text-white">Existing open request</p>
          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="font-medium">{mockResourceRequests[0].resourceName}</p>
            <p className="mt-1 text-sm text-muted">
              {mockResourceRequests[0].quantityNeeded} units • {mockResourceRequests[0].urgency} priority
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
*/
