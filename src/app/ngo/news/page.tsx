"use client";

import { FormEvent, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import type { NewsUpdate } from "@/lib/types";

export default function NgoNewsPage() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [news, setNews] = useState<NewsUpdate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasAwsConfig) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadNews() {
      configureAmplify();
      const client = generateClient();

      try {
        setLoading(true);
        setError(null);

        const result = await client.graphql({
          query: queries.getNewsUpdates,
          authMode: "userPool"
        });

        if (!active) return;

        setNews((((result as any).data?.getNewsUpdates ?? []) as NewsUpdate[]).sort((left, right) =>
          String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""))
        ));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load published field updates.");
        setNews([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNews();

    return () => {
      active = false;
    };
  }, [hasAwsConfig]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    if (!hasAwsConfig) {
      setMessage("Live backend is not configured, so this update cannot be saved to the database.");
      return;
    }

    configureAmplify();
    const client = generateClient();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const result = await client.graphql({
        query: mutations.createNewsUpdate,
        authMode: "userPool",
        variables: {
          input: {
            title: String(form.get("title") ?? "").trim(),
            category: String(form.get("category") ?? "").trim(),
            content: String(form.get("content") ?? "").trim()
          }
        }
      });

      const createdUpdate = (result as any).data?.createNewsUpdate as NewsUpdate | undefined;
      if (!createdUpdate?.id) {
        throw new Error("The backend did not return the saved news update.");
      }

      setNews((current) => [createdUpdate, ...current]);
      formElement.reset();
      setMessage(`Field update saved to the database. Update ID: ${createdUpdate.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to publish the field update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <CardTitle>Published field updates</CardTitle>
        <CardDescription className="mt-2">Situation reports authored by response teams and loaded from the backend.</CardDescription>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {news.map((item) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5" key={item.id}>
              <h3 className="font-medium text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{item.content}</p>
            </div>
          ))}
          {!news.length && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-muted">
              No field updates were found in the database yet.
            </div>
          ) : null}
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
          <Button className="w-full" disabled={saving} type="submit">
            {saving ? "Publishing..." : "Publish update"}
          </Button>
        </form>
        {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      </Card>
    </div>
  );
}
