import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/server-auth";
import { limitPublicHazardRead } from "@/lib/hazards/http";
import { publicSnapshot } from "@/lib/hazards/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public map DTO only: no actor, evidence, household details or personal route requests. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    limitPublicHazardRead(request);
    return NextResponse.json(await publicSnapshot(), { headers });
  } catch (error) {
    if (error instanceof AuthError && error.status === 429) return NextResponse.json({ error: error.message }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    return NextResponse.json({ error: "The public hazard map is temporarily unavailable. Please retry shortly." }, { status: 503, headers });
  }
}
