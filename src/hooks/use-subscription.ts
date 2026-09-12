"use client";

import { useEffect } from "react";
import { generateClient } from "aws-amplify/api";

import { configureAmplify } from "@/lib/aws/amplify";

export function useSubscription<TData = unknown>(
  query: string,
  onMessage: (payload: TData) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    configureAmplify();
    const hasConfig = Boolean(process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL);
    if (!hasConfig) return;

    const client = generateClient();
    const subscription = (client.graphql({ query }) as any).subscribe({
      next: (value: TData) => onMessage(value),
      error: (error: unknown) => console.error("Subscription error", error)
    });

    return () => subscription.unsubscribe();
  }, [enabled, onMessage, query]);
}
