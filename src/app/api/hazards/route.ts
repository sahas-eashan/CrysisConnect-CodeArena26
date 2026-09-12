import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthError, requireSameOrigin } from "@/lib/server-auth";
import { readHazardBody, limitHazardAction } from "@/lib/hazards/http";
import * as hazards from "@/lib/hazards/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const point = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const photo = z.object({ dataUrl: z.string().max(5_600_000), capturedAt: z.string().optional() });
const id = z.string().min(1).max(100);
const notes = z.string().trim().min(3).max(2000);
const weather = z.object({
  stationId: z.string().trim().min(1).max(100), location: point,
  rainfallMm: z.number().finite().nonnegative(), waterLevelM: z.number().finite().nonnegative(),
  dangerLevelM: z.number().finite().positive(), observedAt: z.string().datetime()
});
const json = (value: unknown) => NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });

function failure(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, { status: 400 });
  const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
  if (status >= 400 && status < 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status });
  return NextResponse.json({ error: "The hazard service is unavailable. Check server configuration and retry; your action has not been confirmed." }, { status: status === 503 ? 503 : 500 });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateRequest(request);
    const latitude = request.nextUrl.searchParams.get("lat");
    const longitude = request.nextUrl.searchParams.get("lon");
    const location = latitude !== null || longitude !== null
      ? point.parse({ latitude: latitude === null || latitude === "" ? NaN : Number(latitude), longitude: longitude === null || longitude === "" ? NaN : Number(longitude) })
      : undefined;
    return json(await hazards.snapshot(actor, location));
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const actor = await authenticateRequest(request);
    const { action, input } = await readHazardBody(request);
    limitHazardAction(actor.id, action);
    switch (action) {
      case "report": return json(await hazards.submitReport(actor, z.object({
        title: z.string().trim().min(3).max(160), description: notes,
        kind: z.enum(["flood", "blocked_road", "fallen_tree", "landslide", "storm", "tsunami", "fire", "other"]),
        location: point, photo, helpRequested: z.boolean().optional(), needs: z.string().max(2000).optional()
      }).parse(input)));
      case "weather": return json(await hazards.submitWeather(actor, weather.parse(input), "operator"));
      case "replay": {
        const { scenario } = z.object({ scenario: z.enum(["normal", "flood"]) }).parse(input);
        return json(await hazards.submitWeather(actor, {
          stationId: "DEMO-KELANI-01", location: { latitude: 6.952, longitude: 79.88 },
          rainfallMm: scenario === "flood" ? 95 : 5,
          waterLevelM: scenario === "flood" ? 5.4 : 1.2,
          dangerLevelM: 4, observedAt: new Date().toISOString()
        }, "replay"));
      }
      case "review": {
        const data = z.object({ id, decision: z.enum(["confirmed", "rejected"]), notes }).parse(input);
        return json(await hazards.reviewCase(actor, data.id, data.decision, data.notes));
      }
      case "requestEvidence": {
        const data = z.object({ id, notes }).parse(input);
        return json(await hazards.requestEvidence(actor, data.id, data.notes));
      }
      case "releaseRelief": {
        const data = z.object({ id, notes }).parse(input);
        return json(await hazards.releaseRelief(actor, data.id, data.notes));
      }
      case "assign": {
        const data = z.object({ id, crew: z.object({ id, name: z.string().trim().min(2).max(100) }) }).parse(input);
        return json(await hazards.assignCase(actor, data.id, data.crew));
      }
      case "close": case "evidence": {
        const data = z.object({ id, photo, notes }).parse(input);
        return json(await (action === "close" ? hazards.closeCase : hazards.addEvidence)(actor, data.id, data.photo, data.notes));
      }
      case "relief": {
        const { id: caseId, ...data } = z.object({ id, organization: z.string().trim().min(2).max(120), resources: notes,
          shelterId: id.optional(), people: z.number().int().positive().max(10000).optional() }).parse(input);
        return json(await hazards.assignRelief(actor, caseId, data));
      }
      case "route": return json(await hazards.planSafeRoute(actor, point.parse(input.location)));
      case "screenRoute": {
        const data = z.object({ coordinates: z.array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-85).max(85)])).min(2).max(20000) }).parse(input);
        return json(await hazards.screenRoute(actor, data.coordinates));
      }
      default: throw new AuthError("Unknown hazard action.", 400);
    }
  } catch (error) { return failure(error); }
}
