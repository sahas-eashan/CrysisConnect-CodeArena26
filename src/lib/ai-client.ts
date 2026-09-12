"use client";

import { generateClient } from "aws-amplify/api";

import { configureAmplify } from "@/lib/aws/amplify";
import { mutations, queries } from "@/lib/aws/graphql/operations";
import {
  mockAiAuditLogs,
  mockAlertDraft,
  mockCitizenGuidance,
  mockIncidentBrief,
  mockOperationsRecommendationSet,
  mockPreparedSosSubmission,
  mockResourceDispatchPlan,
  mockSosTriage
} from "@/lib/mock-data";
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

async function runGraphql<T>(request: { query: string; variables?: Record<string, unknown> }, fallback: T): Promise<T> {
  if (!hasAwsConfig()) return fallback;

  configureAmplify();
  const client = generateClient();
  const result = await client.graphql(request);
  return result as unknown as T;
}

export async function getCitizenGuidance(disasterId?: string | null) {
  if (!hasAwsConfig()) return mockCitizenGuidance;
  const result = (await runGraphql<any>(
    {
      query: queries.getCitizenGuidance,
      variables: { disasterId: disasterId ?? null }
    },
    null
  )) as any;

  return ((result?.data?.getCitizenGuidance ?? mockCitizenGuidance) as CitizenGuidance);
}

export async function getAiAuditLogs(limit = 20) {
  if (!hasAwsConfig()) return mockAiAuditLogs;
  const result = (await runGraphql<any>(
    {
      query: queries.getAiAuditLogs,
      variables: { limit }
    },
    null
  )) as any;

  return ((result?.data?.getAiAuditLogs ?? mockAiAuditLogs) as AiAuditRef[]);
}

export async function generateIncidentBrief(disasterId?: string | null) {
  if (!hasAwsConfig()) return mockIncidentBrief;
  const result = (await runGraphql<any>(
    {
      query: mutations.generateIncidentBrief,
      variables: { disasterId: disasterId ?? null }
    },
    null
  )) as any;

  return ((result?.data?.generateIncidentBrief ?? mockIncidentBrief) as IncidentBrief);
}

export async function generateAlertDraft(input: {
  title: string;
  body: string;
  channel: string[];
  targetRoles?: string[];
  disasterId?: string | null;
}) {
  if (!hasAwsConfig()) {
    return {
      ...mockAlertDraft,
      title: input.title || mockAlertDraft.title,
      channel: input.channel.length ? input.channel : mockAlertDraft.channel
    };
  }

  const result = (await runGraphql<any>(
    {
      query: mutations.generateAlertDraft,
      variables: {
        input: {
          ...input,
          targetRoles: input.targetRoles ?? [],
          disasterId: input.disasterId ?? null
        }
      }
    },
    null
  )) as any;

  return ((result?.data?.generateAlertDraft ?? mockAlertDraft) as AlertDraft);
}

export async function recommendOperations(timeframe = "next_6_hours") {
  if (!hasAwsConfig()) return mockOperationsRecommendationSet;
  const result = (await runGraphql<any>(
    {
      query: mutations.recommendOperations,
      variables: { timeframe }
    },
    null
  )) as any;

  return ((result?.data?.recommendOperations ?? mockOperationsRecommendationSet) as OperationsRecommendationSet);
}

export async function triageSosCase(id: string) {
  if (!hasAwsConfig()) return mockSosTriage;
  const result = (await runGraphql<any>(
    {
      query: mutations.triageSosCase,
      variables: { id }
    },
    null
  )) as any;

  return ((result?.data?.triageSosCase ?? mockSosTriage) as SosTriage);
}

export async function recommendResourceDispatch(id: string) {
  if (!hasAwsConfig()) return mockResourceDispatchPlan;
  const result = (await runGraphql<any>(
    {
      query: mutations.recommendResourceDispatch,
      variables: { id }
    },
    null
  )) as any;

  return ((result?.data?.recommendResourceDispatch ?? mockResourceDispatchPlan) as ResourceDispatchPlan);
}

export async function prepareSosSubmission(input: { type: string; description: string }) {
  if (!hasAwsConfig()) {
    return {
      ...mockPreparedSosSubmission,
      original: input.description,
      refined: `${input.type.toUpperCase()} emergency: ${input.description.trim()}`
    };
  }

  const result = (await runGraphql<any>(
    {
      query: mutations.prepareSosSubmission,
      variables: {
        input
      }
    },
    null
  )) as any;

  return ((result?.data?.prepareSosSubmission ?? mockPreparedSosSubmission) as PreparedSosSubmission);
}
