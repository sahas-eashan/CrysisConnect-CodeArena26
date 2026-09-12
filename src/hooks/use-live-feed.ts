"use client";

import { useCallback, useEffect, useState } from "react";
import { generateClient } from "aws-amplify/api";

import { configureAmplify } from "@/lib/aws/amplify";
import { queries, subscriptions } from "@/lib/aws/graphql/operations";
import type { Alert, NewsUpdate } from "@/lib/types";

import { useSubscription } from "./use-subscription";

type LiveFeedState = {
  alerts: Alert[];
  alertsError: string | null;
  loading: boolean;
  news: NewsUpdate[];
  newsError: string | null;
  status: string;
};

const defaultState: LiveFeedState = {
  alerts: [],
  alertsError: null,
  loading: Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL),
  news: [],
  newsError: null,
  status: process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL
    ? "Loading live news and alerts from the backend..."
    : "Live backend is not configured."
};

export function useLiveFeed(enabled = true) {
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
    ,
    enabled
  );

  useSubscription(
    subscriptions.onAlert,
    useCallback(() => {
      requestRefresh("New emergency alert received. Refreshing feed...");
    }, [requestRefresh])
    ,
    enabled
  );

  useEffect(() => {
    if (!enabled) {
      setState({
        alerts: [],
        alertsError: null,
        loading: false,
        news: [],
        newsError: null,
        status: "Live feed is not active for this view."
      });
      return;
    }

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
          alertsError: null,
          loading: true
          ,
          newsError: null
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

        const alertsError =
          alertsResult.status === "rejected"
            ? alertsResult.reason instanceof Error
              ? alertsResult.reason.message
              : "Unable to load alerts from the backend."
            : null;
        const newsError =
          newsResult.status === "rejected"
            ? newsResult.reason instanceof Error
              ? newsResult.reason.message
              : "Unable to load news from the backend."
            : null;

        setState({
          alerts,
          alertsError,
          loading: false,
          news,
          newsError,
          status:
            alertsError || newsError
              ? "Live feed loaded with partial data."
              : "Connected to live news and alerts."
        });
      } catch (error) {
        if (!active) return;

        setState({
          alerts: [],
          alertsError: error instanceof Error ? error.message : "Unable to load alerts from the backend.",
          loading: false,
          news: [],
          newsError: error instanceof Error ? error.message : "Unable to load news from the backend.",
          status: "Unable to reach the live backend."
        });
      }
    }

    void loadFeed();

    return () => {
      active = false;
    };
  }, [enabled, hasAwsConfig, refreshKey]);

  return {
    ...state,
    refresh: requestRefresh
  };
}
