"use client";

import { Amplify } from "aws-amplify";

let configured = false;

export function configureAmplify() {
  if (configured) return;

  const region = process.env.NEXT_PUBLIC_AWS_REGION;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
  const graphqlUrl = process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL;

  if (!region || !userPoolId || !userPoolClientId || !graphqlUrl) {
    configured = true;
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          email: true,
          phone: true
        }
      }
    },
    API: {
      GraphQL: {
        endpoint: graphqlUrl,
        region,
        defaultAuthMode: "userPool"
      }
    }
  });

  configured = true;
}
