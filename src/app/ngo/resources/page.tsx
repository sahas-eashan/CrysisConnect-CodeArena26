"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockResourceRequests, mockResources } from "@/lib/mock-data";

export default function NgoResourcesPage() {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Resource mutation prepared. In live mode this updates RDS through AppSync and broadcasts via onResourceUpdate.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <CardTitle>Manage field inventory</CardTitle>
        <CardDescription className="mt-2">
          Publish stock levels so citizens and government teams share the same operating picture.
        </CardDescription>
        <div className="mt-6 space-y-3">
          {mockResources.map((resource) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={resource.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{resource.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {resource.quantity} {resource.unit} • {resource.category}
                  </p>
                </div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-300">{resource.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <p className="text-sm font-medium text-white">Incoming citizen requests</p>
          <div className="mt-3 space-y-3">
            {mockResourceRequests.map((request) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4" key={request.id}>
                <p className="font-medium text-white">{request.resourceName}</p>
                <p className="mt-1 text-sm text-muted">
                  Needs {request.quantityNeeded} • {request.urgency} priority
                </p>
                <div className="mt-3">
                  <Button>Mark as fulfilled</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Add or update a resource</CardTitle>
        <CardDescription className="mt-2">
          Fast updates from the field keep routing and allocation accurate.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="name" placeholder="Resource name" required />
          <Input name="category" placeholder="Category" required />
          <Input min={0} name="quantity" placeholder="Quantity" required type="number" />
          <Input name="unit" placeholder="Unit" required />
          <Input name="location" placeholder='GeoJSON Point, e.g. {"type":"Point","coordinates":[79.87,6.93]}' />
          <Button className="w-full" type="submit">
            Save resource update
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>
    </div>
  );
}
