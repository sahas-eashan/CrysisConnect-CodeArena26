"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mockNews } from "@/lib/mock-data";

export default function NgoNewsPage() {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Field update ready. In live mode this mutation will publish to citizens and government dashboards through onNewNews.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <CardTitle>Published field updates</CardTitle>
        <CardDescription className="mt-2">Situation reports authored by response teams.</CardDescription>
        <div className="mt-6 space-y-4">
          {mockNews.map((item) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={item.id}>
              <h3 className="font-medium text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{item.content}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Create update</CardTitle>
        <CardDescription className="mt-2">Broadcast on-ground changes such as road closures, camp openings, or medical shortages.</CardDescription>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Input name="title" placeholder="Update title" required />
          <Input name="category" placeholder="Category" required />
          <textarea
            className="min-h-40 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
            name="content"
            placeholder="Write the field situation report..."
            required
          />
          <Button className="w-full" type="submit">
            Publish update
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>
    </div>
  );
}
