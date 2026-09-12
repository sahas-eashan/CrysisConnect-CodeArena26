import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthError, requireSameOrigin } from "@/lib/server-auth";
import { readHazardBody, limitHazardAction } from "@/lib/hazards/http";
import { notesSchema as notes, photoSchema as photo, pointSchema as point } from "@/lib/hazards/validation";
import type { HazardActor, HazardRole } from "@/lib/hazards/types";
import * as hazards from "@/lib/hazards/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const id = z.string().trim().min(1).max(200);
const urgency = z.enum(["low", "moderate", "high", "critical", "unknown"]);
const weather = z.object({
  stationId: z.string().trim().min(2).max(100), location: point,
  rainfallMm: z.number().finite().min(0).max(3000), waterLevelM: z.number().finite().min(0).max(100),
  dangerLevelM: z.number().finite().positive().max(100), observedAt: z.string().datetime({ offset: true })
}).strict();
const json = (value: unknown) => NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });
const requireRole = (actor: HazardActor, ...roles: HazardRole[]) => {
  if (!roles.includes(actor.role)) throw new AuthError("Your role cannot perform this action.", 403);
};

function failure(error: unknown) {
  const headers = { "Cache-Control": "no-store" };
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, { status: 400, headers });
  const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
  if (status >= 400 && status < 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status, headers });
  return NextResponse.json({ error: "The hazard service is unavailable. Check server configuration and retry; your action has not been confirmed." }, { status: status === 503 ? 503 : 500, headers });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateRequest(request);
    limitHazardAction(actor.id, "snapshot");
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
        title: z.string().trim().min(5).max(160), description: z.string().trim().min(10).max(4000),
        kind: z.enum(["flood", "blocked_road", "fallen_tree", "landslide", "storm", "tsunami", "fire", "other"]),
        location: point, photo, helpRequested: z.boolean().optional(), needs: z.string().trim().max(1000).optional()
      }).strict().parse(input)));
      case "weather": return json(await hazards.submitWeather(actor, weather.parse(input), "operator"));
      case "replay": {
        const { scenario } = z.object({ scenario: z.enum(["normal", "flood"]) }).strict().parse(input);
        return json(await hazards.submitWeather(actor, {
          stationId: "DEMO-KELANI-01", location: { latitude: 6.952, longitude: 79.88 },
          rainfallMm: scenario === "flood" ? 95 : 5,
          waterLevelM: scenario === "flood" ? 5.4 : 1.2,
          dangerLevelM: 4, observedAt: new Date().toISOString()
        }, "replay"));
      }
      case "review": {
        const data = z.object({ id, decision: z.enum(["confirmed", "rejected"]), notes, urgency: urgency.optional() }).strict().parse(input);
        return json(await hazards.reviewCase(actor, data.id, data.decision, data.notes, data.urgency));
      }
      case "requestEvidence": {
        const data = z.object({ id, notes }).strict().parse(input);
        return json(await hazards.requestEvidence(actor, data.id, data.notes));
      }
      case "releaseRelief": {
        const data = z.object({ id, notes }).strict().parse(input);
        return json(await hazards.releaseRelief(actor, data.id, data.notes));
      }
      case "assign": {
        const data = z.object({ id, crew: z.object({ id, name: z.string().trim().min(2).max(160) }).strict() }).strict().parse(input);
        return json(await hazards.assignCase(actor, data.id, data.crew));
      }
      case "close": case "evidence": {
        const data = z.object({ id, photo, notes }).strict().parse(input);
        return json(await (action === "close" ? hazards.closeCase : hazards.addEvidence)(actor, data.id, data.photo, data.notes));
      }
      case "relief": {
        const { id: caseId, ...data } = z.object({ id, organization: z.string().trim().min(2).max(160), resources: z.string().trim().min(3).max(2000),
          shelterId: id.optional(), people: z.number().int().positive().max(1000).optional() }).strict().parse(input);
        return json(await hazards.assignRelief(actor, caseId, data));
      }
      case "autoRelief": {
        requireRole(actor, "government", "relief");
        const { id: caseId, ...data } = z.object({ id, organization: z.string().trim().min(2).max(160), resources: z.string().trim().min(3).max(2000), people: z.number().int().positive().max(1000) }).strict().parse(input);
        return json(await hazards.autoRelief(actor, caseId, data));
      }
      case "location": {
        requireRole(actor, "citizen");
        const data = z.object({ location: point, alertsEnabled: z.boolean().optional().default(true) }).strict().parse(input);
        return json(await hazards.updateLocation(actor, data.location, data.alertsEnabled));
      }
      case "forgetLocation": {
        requireRole(actor, "citizen");
        z.object({}).strict().parse(input);
        return json(await hazards.forgetLocation(actor));
      }
      case "requestCommunity": {
        requireRole(actor, "government");
        const data = z.object({ id, notes }).strict().parse(input);
        return json(await hazards.requestCommunity(actor, data.id, data.notes));
      }
      case "confirmCommunity": {
        requireRole(actor, "citizen");
        const { invitationId, ...data } = z.object({ invitationId: id, location: point, photo, notes, observation: z.enum(["supports", "contradicts"]) }).strict().parse(input);
        return json(await hazards.confirmCommunity(actor, invitationId, data));
      }
      case "banReporter": {
        requireRole(actor, "government");
        const data = z.object({ reporterId: id, caseId: id, reason: notes }).strict().parse(input);
        return json(await hazards.banReporter(actor, data));
      }
      case "unbanReporter": {
        requireRole(actor, "government");
        const data = z.object({ reporterId: id, reason: notes }).strict().parse(input);
        return json(await hazards.unbanReporter(actor, data));
      }
      case "assignCouncil": {
        requireRole(actor, "government");
        const { id: caseId, ...data } = z.object({ id, councilId: id, councilName: z.string().trim().min(2).max(200), notes }).strict().parse(input);
        return json(await hazards.assignCouncil(actor, caseId, data));
      }
      case "route": {
        const data = z.object({ location: point }).strict().parse(input);
        return json(await hazards.planSafeRoute(actor, data.location));
      }
      case "screenRoute": {
        const data = z.object({ coordinates: z.array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)])).min(2).max(20000) }).strict().parse(input);
        return json(await hazards.screenRoute(actor, data.coordinates));
      }
      default: throw new AuthError("Unknown hazard action.", 400);
    }
  } catch (error) { return failure(error); }
}
