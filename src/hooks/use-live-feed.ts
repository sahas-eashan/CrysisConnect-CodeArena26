"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { configureAmplify } from "@/lib/aws/amplify";
import { queries, subscriptions } from "@/lib/aws/graphql/operations";
import type { Alert, NewsUpdate } from "@/lib/types";

import { useSubscription } from "./use-subscription";

type LiveFeedState = {
  alerts: Alert[];
  error: string | null;
  loading: boolean;
  news: NewsUpdate[];
  status: string;
};

const defaultState: LiveFeedState = {
  alerts: [],
  error: null,
  loading: Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL),
  news: [],
  status: process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL
    ? "Loading live news and alerts from the backend..."
    : "Live backend is not configured."
};

export function useLiveFeed() {
  const hasAwsConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
  const [state, setState] = useState<LiveFeedState>(defaultState);
  const [refreshKey, setRefreshKey] = useState(0);

  const requestRefresh = useCallback((message: string) => {
    setState((current) => ({
      ...current,
      status: message
    }));
    setRefreshKey((value) => value + 1);
  }, []);

  useSubscription(
    subscriptions.onNewNews,
    useCallback(() => {
      requestRefresh("Live news update received. Refreshing feed...");
    }, [requestRefresh])
  );

  useSubscription(
    subscriptions.onAlert,
    useCallback(() => {
      requestRefresh("New emergency alert received. Refreshing feed...");
    }, [requestRefresh])
  );

  useEffect(() => {
    if (!hasAwsConfig) {
      setState(defaultState);
      return;
    }

    let active = true;

    async function loadFeed() {
      configureAmplify();
      const client = generateClient();

      try {
        setState((current) => ({
          ...current,
          error: null,
          loading: true
        }));

        const [alertsResult, newsResult] = await Promise.allSettled([
          client.graphql({ query: queries.getAlerts, authMode: "userPool" }),
          client.graphql({ query: queries.getNewsUpdates, authMode: "userPool" })
        ]);

        if (!active) return;

        const alerts =
          alertsResult.status === "fulfilled" ? (((alertsResult.value as any).data?.getAlerts ?? []) as Alert[]) : [];
        const news =
          newsResult.status === "fulfilled"
            ? (((newsResult.value as any).data?.getNewsUpdates ?? []) as NewsUpdate[])
            : [];

        const errorMessages = [
          alertsResult.status === "rejected"
            ? alertsResult.reason instanceof Error
              ? alertsResult.reason.message
              : "Unable to load alerts from the backend."
            : null,
          newsResult.status === "rejected"
            ? newsResult.reason instanceof Error
              ? newsResult.reason.message
              : "Unable to load news from the backend."
            : null
        ].filter((message): message is string => Boolean(message));

        setState({
          alerts,
          error: errorMessages[0] ?? null,
          loading: false,
          news,
          status:
            errorMessages.length > 0
              ? "Live feed loaded with partial data."
              : "Connected to live news and alerts."
        });
      } catch (error) {
        if (!active) return;

        setState({
          alerts: [],
          error: error instanceof Error ? error.message : "Unable to load the live feed.",
          loading: false,
          news: [],
          status: "Unable to reach the live backend."
        });
      }
    }

    void loadFeed();

    return () => {
      active = false;
    };
  }, [hasAwsConfig, refreshKey]);

  return {
    ...state,
    refresh: requestRefresh
  };
}
