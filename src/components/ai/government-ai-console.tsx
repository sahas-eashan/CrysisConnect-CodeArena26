"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, FileSearch, Siren } from "lucide-react";

import { generateIncidentBrief, recommendOperations } from "@/lib/ai-client";
import type { IncidentBrief, OperationsRecommendationSet } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const recordIdPattern = /\(ID:\s*([^)]+)\)/gi;
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function priorityBadgeClass(priority?: string) {
  const normalized = priority?.toLowerCase() ?? "medium";
  if (normalized === "critical") return "border-danger/40 bg-danger/15 text-red-200";
  if (normalized === "high") return "border-secondary/40 bg-secondary/15 text-yellow-200";
  if (normalized === "low") return "border-success/40 bg-success/15 text-emerald-200";
  return "border-sky-400/30 bg-sky-400/15 text-sky-100";
}

function resolveCommandLink(id: string, context: string) {
  const lower = context.toLowerCase();
  if (lower.includes("sos") || lower.includes("responder") || lower.includes("evacuation")) {
    return `/admin/sos-queue#${id}`;
  }
  if (lower.includes("resource") || lower.includes("inventory") || lower.includes("stock")) {
    return `/admin/resources#${id}`;
  }
  if (lower.includes("shelter") || lower.includes("safe zone")) {
    return `/admin/safe-zones#${id}`;
  }
  return `/admin/disasters#${id}`;
}

function resolveCommandDestination(context: string) {
  const lower = context.toLowerCase();
  if (lower.includes("sos") || lower.includes("responder") || lower.includes("evacuation") || lower.includes("rescue")) {
    return { href: "/admin/sos-queue", label: "Open SOS queue" };
  }
  if (lower.includes("resource") || lower.includes("inventory") || lower.includes("stock") || lower.includes("supply")) {
    return { href: "/admin/resources", label: "Open resources" };
  }
  if (lower.includes("shelter") || lower.includes("safe zone") || lower.includes("capacity")) {
    return { href: "/admin/safe-zones", label: "Open shelters" };
  }
  return { href: "/admin/disasters", label: "Open incident" };
}

function linkLabelForHref(href: string, index: number, total: number) {
  const baseLabel = href.startsWith("/admin/sos-queue")
    ? "Open SOS case"
    : href.startsWith("/admin/resources")
      ? "Open resource"
      : href.startsWith("/admin/safe-zones")
        ? "Open shelter"
        : "Open incident";

  return total > 1 ? `${baseLabel} ${index + 1}` : baseLabel;
}

function renderRecommendationDetail(
  detail: string,
  recommendationTitle: string,
  relatedIds?: string[] | null
) {
  const labeledMatches = [...detail.matchAll(recordIdPattern)].flatMap((match) =>
    match[1]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const rawUuidMatches = detail.match(uuidPattern) ?? [];
  const caseIds = [...new Set([...(relatedIds ?? []), ...labeledMatches, ...rawUuidMatches])];
  const cleaned = detail
    .replace(recordIdPattern, "")
    .replace(/\(([0-9a-f,\s-]{36,})\)/gi, "")
    .replace(/\bIDs?:\s*[0-9a-f,\s-]{36,}/gi, "")
    .replace(uuidPattern, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
  const destination = resolveCommandDestination(`${recommendationTitle} ${detail}`);

  return (
    <div className="mt-2 space-y-3 text-sm text-slate-200">
      <p>{cleaned}</p>
      {caseIds.length ? (
        <div className="flex flex-wrap gap-2">
          {caseIds.map((id, index) => {
            const href = resolveCommandLink(id, `${recommendationTitle} ${detail}`);
            return (
              <Link
                className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
                href={href}
                key={`${recommendationTitle}-${id}-${index}`}
              >
                {linkLabelForHref(href, index, caseIds.length)}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/20"
            href={destination.href}
          >
            {destination.label}
          </Link>
        </div>
      )}
    </div>
  );
}

function sourceLinkForId(id: string) {
  if (id.startsWith("ngo") || id.startsWith("sos") || id === "88888888-8888-8888-8888-888888888888") {
    return `/admin/sos-queue#${id}`;
  }

  if (id.startsWith("res") || id.startsWith("req")) {
    return `/admin/resources#${id}`;
  }

  return `/admin/disasters#${id}`;
}

export function GovernmentAiConsole({ disasterId }: { disasterId?: string | null }) {
  const [brief, setBrief] = useState<IncidentBrief | null>(null);
  const [operations, setOperations] = useState<OperationsRecommendationSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [nextBrief, nextOperations] = await Promise.all([
        generateIncidentBrief(disasterId),
        recommendOperations("next_6_hours")
      ]);
      setBrief(nextBrief);
      setOperations(nextOperations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load AI command console.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [disasterId]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-sky-500/10 via-slate-950/90 to-emerald-500/10 shadow-[0_20px_60px_rgba(14,165,233,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge className="border-primary/40 bg-primary/10 text-primary">AI command copilot</Badge>
          <CardTitle className="mt-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Live command review
          </CardTitle>
          <CardDescription className="mt-2">
            Incident summarization and operations ranking are generated from live CrisisConnect records, but public actions still require human approval.
          </CardDescription>
        </div>
        <Button className="border-primary/30 bg-white/5 hover:bg-primary/10" onClick={() => void load()} variant="outline">
          Refresh
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Analyzing current operations...</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-950/90 to-sky-950/40 p-4">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-white">Incident brief</p>
          </div>
          <p className="mt-3 text-lg font-semibold text-white">{brief?.headline}</p>
          <p className="mt-3 text-sm text-slate-300">{brief?.summary}</p>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {brief?.rationale.bullets.map((bullet) => (
              <p key={bullet}>{bullet}</p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-950/90 to-emerald-950/40 p-4">
          <div className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-white">Top next actions</p>
          </div>
          <div className="mt-4 space-y-3">
            {operations?.recommendations.map((recommendation) => (
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3" key={recommendation.title}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{recommendation.title}</p>
                  <Badge className={priorityBadgeClass(recommendation.priority)}>{recommendation.priority}</Badge>
                </div>
                {renderRecommendationDetail(recommendation.detail, recommendation.title, recommendation.relatedIds)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {brief ? (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          <Badge>{brief.meta.status === "completed" ? "Gemini live" : brief.meta.status}</Badge>
          <Badge>{Math.round(brief.meta.confidence * 100)}% confidence</Badge>
          <Badge>{brief.meta.requiresHumanApproval ? "Human review required" : "Autonomous"}</Badge>
          <Badge>Audit: {brief.meta.audit.id}</Badge>
          {brief.meta.sourceIds.slice(0, 4).map((id) => (
            <Link
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              href={sourceLinkForId(id)}
              key={id}
            >
              Open source
            </Link>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
