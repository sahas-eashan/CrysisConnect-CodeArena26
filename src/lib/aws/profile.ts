"use client";

import { generateClient } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";
import { configureAmplify } from "./amplify";

let lastSaved: { subject: string; latitude: number; longitude: number; at: number } | undefined;

/** Persist a location the user has consented to share, so geofenced alerts can reach them. */
export async function saveMyLocation(location: { latitude: number; longitude: number }) {
  if (!process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL) return;
  configureAmplify();
  const subject = (await fetchAuthSession()).tokens?.idToken?.payload.sub;
  if (!subject) throw new Error("Sign in to enable alerts for this location.");
  if (lastSaved?.subject === subject && lastSaved.latitude === location.latitude && lastSaved.longitude === location.longitude && Date.now() - lastSaved.at < 60_000) return;
  const result = await generateClient().graphql({
    query: "mutation UpdateMyLocation($latitude: Float!, $longitude: Float!) { updateMyLocation(latitude: $latitude, longitude: $longitude) }",
    variables: location, authMode: "userPool"
  }) as { data?: { updateMyLocation?: boolean }; errors?: { message: string }[] };
  if (result.errors?.length || !result.data?.updateMyLocation) throw new Error("Your location could not be saved for area alerts. Please retry.");
  lastSaved = { subject, ...location, at: Date.now() };
}
