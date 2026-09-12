"use client";

import { generateClient } from "aws-amplify/api";

import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import type {
  AiAuditRef,
  AlertDraft,
  CitizenGuidance,
  IncidentBrief,
  OperationsRecommendationSet,
  PreparedSosSubmission,
  ResourceDispatchPlan,
  SosTriage
} from "@/lib/types";

const hasAwsConfig = () => Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
const inflightRequests = new Map<string, Promise<any>>();
const recentResponses = new Map<string, { expiresAt: number; value: any }>();
const DEFAULT_CACHE_MS = 15_000;

function requireAwsConfig() {
  if (!hasAwsConfig()) {
    throw new Error("Live AI backend is not configured.");
  }
}

function readGraphqlError(result: any) {
  const message =
    result?.errors?.[0]?.message ??
    result?.errors?.[0]?.errorInfo?.message ??
    result?.errors?.[0]?.originalError?.message;

  return typeof message === "string" && message.trim() ? message : null;
}

function normalizeGraphqlError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message =
    (error as any)?.errors?.[0]?.message ??
    (error as any)?.errors?.[0]?.errorInfo?.message ??
    (error as any)?.data?.errors?.[0]?.message ??
    (error as any)?.message;

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return "Unable to reach the live AI backend.";
}

function requirePayload<T>(value: T | null | undefined, name: string) {
  if (value == null) {
    throw new Error(`Live AI backend returned no ${name}.`);
  }

  return value;
}

async function runGraphql(request: { query: string; variables?: Record<string, unknown> }) {
  requireAwsConfig();

  configureAmplify();
  const client = generateClient();
  try {
    const result = await client.graphql({
      ...request,
      authMode: "userPool"
    });
    const errorMessage = readGraphqlError(result);

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return result as any;
  } catch (error) {
    const message = normalizeGraphqlError(error);
    if (message.toLowerCase().includes("unauthorized")) {
      throw new Error("Sign in with a Cognito account to use live AI guidance.");
    }
    throw new Error(message);
  }
}

async function runCached<T>(key: string, factory: () => Promise<T>, ttlMs = DEFAULT_CACHE_MS) {
  const cached = recentResponses.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const inflight = inflightRequests.get(key);
  if (inflight) {
    return (await inflight) as T;
  }

  const nextPromise = factory()
    .then((value) => {
      recentResponses.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
      });
      inflightRequests.delete(key);
      return value;
    })
    .catch((error) => {
      inflightRequests.delete(key);
      throw error;
    });

  inflightRequests.set(key, nextPromise);
  return (await nextPromise) as T;
}

export async function getCitizenGuidance(disasterId?: string | null) {
  return runCached(`getCitizenGuidance:${disasterId ?? "active"}`, async () => {
    const result = await runGraphql({
      query: queries.getCitizenGuidance,
      variables: { disasterId: disasterId ?? null }
    });

    return requirePayload(result?.data?.getCitizenGuidance as CitizenGuidance | null | undefined, "citizen guidance");
  });
}

export async function getAiAuditLogs(limit = 20) {
  return runCached(
    `getAiAuditLogs:${limit}`,
    async () => {
      const result = await runGraphql({
        query: queries.getAiAuditLogs,
        variables: { limit }
      });

      return (result?.data?.getAiAuditLogs ?? []) as AiAuditRef[];
    },
    5_000
  );
}

export async function reviewAiAuditLog(id: string, approved: boolean) {
  const result = await runGraphql({
    query: mutations.reviewAiAuditLog,
    variables: { id, approved }
  });

  recentResponses.delete("getAiAuditLogs:20");
  recentResponses.delete("getAiAuditLogs:50");
  return requirePayload(result?.data?.reviewAiAuditLog as AiAuditRef | null | undefined, "AI audit review");
}

export async function generateIncidentBrief(disasterId?: string | null) {
  return runCached(`generateIncidentBrief:${disasterId ?? "active"}`, async () => {
    const result = await runGraphql({
      query: mutations.generateIncidentBrief,
      variables: { disasterId: disasterId ?? null }
    });

    return requirePayload(result?.data?.generateIncidentBrief as IncidentBrief | null | undefined, "incident brief");
  });
}

export async function generateAlertDraft(input: {
  title: string;
  body: string;
  channel: string[];
  targetRoles?: string[];
  disasterId?: string | null;
}) {
  const normalizedInput = {
    ...input,
    targetRoles: input.targetRoles ?? [],
    disasterId: input.disasterId ?? null
  };

  return runCached(`generateAlertDraft:${JSON.stringify(normalizedInput)}`, async () => {
    const result = await runGraphql({
      query: mutations.generateAlertDraft,
      variables: {
        input: normalizedInput
      }
    });

    return requirePayload(result?.data?.generateAlertDraft as AlertDraft | null | undefined, "alert draft");
  });
}

export async function recommendOperations(timeframe = "next_6_hours") {
  return runCached(`recommendOperations:${timeframe}`, async () => {
    const result = await runGraphql({
      query: mutations.recommendOperations,
      variables: { timeframe }
    });

    return requirePayload(
      result?.data?.recommendOperations as OperationsRecommendationSet | null | undefined,
      "operations recommendation set"
    );
  });
}

export async function triageSosCase(id: string) {
  return runCached(`triageSosCase:${id}`, async () => {
    const result = await runGraphql({
      query: mutations.triageSosCase,
      variables: { id }
    });

    return requirePayload(result?.data?.triageSosCase as SosTriage | null | undefined, "SOS triage analysis");
  });
}

export async function recommendResourceDispatch(id: string) {
  return runCached(`recommendResourceDispatch:${id}`, async () => {
    const result = await runGraphql({
      query: mutations.recommendResourceDispatch,
      variables: { id }
    });

    return requirePayload(
      result?.data?.recommendResourceDispatch as ResourceDispatchPlan | null | undefined,
      "resource dispatch plan"
    );
  });
}

export async function prepareSosSubmission(input: { type: string; description: string }) {
  return runCached(`prepareSosSubmission:${JSON.stringify(input)}`, async () => {
    const result = await runGraphql({
      query: mutations.prepareSosSubmission,
      variables: {
        input
      }
    });

    return requirePayload(
      result?.data?.prepareSosSubmission as PreparedSosSubmission | null | undefined,
      "prepared SOS submission"
    );
  });
}
