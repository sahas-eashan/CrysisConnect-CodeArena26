import { NextRequest, NextResponse } from "next/server";

const allowedRoles = new Set(["citizen", "ngo", "government"]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = typeof body.role === "string" && allowedRoles.has(body.role) ? body.role : "citizen";

  const response = NextResponse.json({ ok: true });
  response.cookies.set("cc-role", role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
