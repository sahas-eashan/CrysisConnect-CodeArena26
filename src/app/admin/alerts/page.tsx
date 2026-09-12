"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminAlertsPage() {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Alert mutation ready. In live mode SNS handles SMS, SES handles email, and AppSync subscriptions notify active sessions.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardTitle>Broadcast emergency alert</CardTitle>
        <CardDescription className="mt-2">
          Choose channels and affected roles. The backend geofences delivery based on the selected polygon.
        </CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="title" placeholder="Alert title" required />
          <textarea
            className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="body"
            placeholder="Alert body"
            required
          />
          <Input name="targetArea" placeholder='Target polygon GeoJSON, e.g. {"type":"Polygon",...}' />
          <Input name="targetRoles" placeholder="Target roles (citizen, ngo, government)" />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
              <input className="mr-2" defaultChecked name="channel" type="checkbox" value="sms" />
              SMS
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
              <input className="mr-2" defaultChecked name="channel" type="checkbox" value="push" />
              Push
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
              <input className="mr-2" name="channel" type="checkbox" value="email" />
              Email
            </label>
          </div>
          <Button className="w-full" type="submit">
            Send multi-channel alert
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>

      <Card>
        <CardTitle>Secondary disaster automation</CardTitle>
        <CardDescription className="mt-2">
          Rule-based warnings are generated automatically when certain disaster types are registered.
        </CardDescription>
        <ul className="mt-6 space-y-3 text-sm text-slate-300">
          <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Earthquake near coast {"->"} tsunami watch</li>
          <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Flood {"->"} water contamination advisory</li>
          <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">Drought {"->"} wildfire risk alert</li>
        </ul>
      </Card>
    </div>
  );
}
