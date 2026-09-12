"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmSignIn,
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

export type LoginResult =
  | { status: "signedIn" }
  | { status: "newPasswordRequired" };

function describeSignInStep(signInStep: string) {
  switch (signInStep) {
    case "CONFIRM_SIGN_UP":
      return "Account confirmation is still required before you can sign in.";
    case "RESET_PASSWORD":
      return "Cognito requires a password reset for this account before sign-in can complete.";
    case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
      return "A new password is required to complete the first sign-in for this account.";
    default:
      return `Cognito returned an unsupported sign-in step: ${signInStep}.`;
  }
}

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
        const result = await signIn({ username, password });

        if (result.isSignedIn || result.nextStep.signInStep === "DONE") {
          await refresh();
          return { status: "signedIn" } as const;
        }

        if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
          return { status: "newPasswordRequired" } as const;
        }

        throw new Error(describeSignInStep(result.nextStep.signInStep));
      },
      async completeNewPassword(newPassword: string) {
        configureAmplify();
        const result = await confirmSignIn({ challengeResponse: newPassword });

        if (!result.isSignedIn && result.nextStep.signInStep !== "DONE") {
          throw new Error(describeSignInStep(result.nextStep.signInStep));
        }

        await refresh();
        return { status: "signedIn" } as const;
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
