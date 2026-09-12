"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmSignUp,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  fetchAuthSession
} from "aws-amplify/auth";

import { configureAmplify } from "@/lib/aws/amplify";

type AuthState = {
  user?: string;
  groups: string[];
  isReady: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: undefined,
    groups: [],
    isReady: false
  });

  const refresh = useCallback(async () => {
    configureAmplify();

    if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
      setState({ user: "demo@crisisconnect.local", groups: ["government"], isReady: true });
      return;
    }

    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const groups = (session.tokens?.idToken?.payload["cognito:groups"] as string[] | undefined) ?? [];

      setState({
        user: currentUser.signInDetails?.loginId ?? currentUser.username,
        groups,
        isReady: true
      });
    } catch {
      setState({ user: undefined, groups: [], isReady: true });
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const api = useMemo(
    () => ({
      ...state,
      async login(username: string, password: string) {
        configureAmplify();
        await signIn({ username, password });
        await refresh();
      },
      async register(username: string, password: string, email: string) {
        configureAmplify();
        await signUp({
          username,
          password,
          options: {
            userAttributes: {
              email
            }
          }
        });
      },
      async confirm(username: string, code: string) {
        configureAmplify();
        await confirmSignUp({ username, confirmationCode: code });
      },
      async logout() {
        if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
          await signOut();
        }
        setState({ user: undefined, groups: [], isReady: true });
      }
    }),
    [refresh, state]
  );

  return api;
}
