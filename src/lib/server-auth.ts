import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { HazardActor, HazardRole } from "@/lib/hazards/types";

export class AuthError extends Error {
  constructor(message: string, public readonly status = 401) { super(message); }
}

export function roleFromClaims(payload: JWTPayload): HazardRole {
  const groups = Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : [];
  if (groups.includes("government")) return "government";
  if (groups.some((group) => ["ngo", "ngo_individual", "ngo_org_member"].includes(String(group)))) return "ngo";
  return "citizen";
}

export function demoEnabled() {
  return !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID &&
    (process.env.NODE_ENV === "development" || process.env.HAZARD_DEMO_MODE === "true");
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyUserToken(token: string) {
  const region = process.env.NEXT_PUBLIC_AWS_REGION;
  const pool = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const audience = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
  if (!region || !pool || !audience) throw new AuthError("Cognito authentication is not configured.", 503);
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${pool}`;
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    keySets.set(issuer, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ["RS256"] });
    if (payload.token_use !== "id" || !payload.sub || !payload.exp) throw new Error("Invalid ID token");
    return {
      actor: {
        id: payload.sub,
        role: roleFromClaims(payload),
        name: typeof payload.name === "string" ? payload.name : undefined
      } satisfies HazardActor,
      expiresAt: payload.exp
    };
  } catch {
    throw new AuthError("Your session is invalid or expired. Please sign in again.");
  }
}

function readCookie(request: Request, name: string) {
  const cookie = (request.headers.get("cookie") ?? "").split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!cookie) return null;
  try { return decodeURIComponent(cookie.slice(name.length + 1)); } catch { return null; }
}

export async function authenticateRequest(request: Request): Promise<HazardActor> {
  if (demoEnabled()) {
    const requested = request.headers.get("x-demo-role") ?? "citizen";
    const role: HazardRole = requested === "government" || requested === "ngo" ? requested : "citizen";
    return { id: `demo-${role}`, role, name: `Demo ${role}` };
  }
  const bearer = request.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : readCookie(request, "cc-session");
  if (!token) throw new AuthError("Sign in to access the hazard workflow.");
  return (await verifyUserToken(token)).actor;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  // Next may normalize request.url to localhost while preserving the browser's Host.
  // An explicitly configured public origin supports a TLS-terminating reverse proxy.
  const url = new URL(request.url);
  const expected = process.env.APP_URL || `${url.protocol}//${request.headers.get("host") || url.host}`;
  try { if (new URL(expected).origin === origin) return; } catch { /* Invalid origin is rejected below. */ }
  throw new AuthError("Cross-origin changes are not permitted.", 403);
}
