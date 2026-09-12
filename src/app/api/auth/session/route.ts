import { NextRequest, NextResponse } from "next/server";
import { AuthError, demoEnabled, requireSameOrigin, verifyUserToken } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const authorization = request.headers.get("authorization");
    if (demoEnabled()) return NextResponse.json({ ok: true, demo: true });
    if (!authorization?.startsWith("Bearer ")) throw new AuthError("A Cognito ID token is required.");
    const token = authorization.slice(7);
    const identity = await verifyUserToken(token);
    const response = NextResponse.json({ ok: true, role: identity.actor.role });
    response.cookies.set("cc-session", token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
      maxAge: Math.max(0, identity.expiresAt - Math.floor(Date.now() / 1000))
    });
    response.cookies.delete("cc-role");
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthError ? error.message : "Unable to create a session." },
      { status: error instanceof AuthError ? error.status : 500 });
  }
}
