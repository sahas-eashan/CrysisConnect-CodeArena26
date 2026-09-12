import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/hazards/route";
import * as publicApi from "../src/app/api/hazards/public/route";
import { limitHazardAction, limitPublicHazardRead } from "../src/lib/hazards/http";

async function demo(run: () => Promise<void>) {
  const names = ["NEXT_PUBLIC_COGNITO_USER_POOL_ID", "HAZARD_DEMO_MODE", "APP_URL"] as const;
  const saved = new Map(names.map(name => [name, process.env[name]]));
  delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  delete process.env.APP_URL;
  process.env.HAZARD_DEMO_MODE = "true";
  try { await run(); }
  finally { for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }
}

function request(action: string, input: unknown, role = "citizen") {
  return new NextRequest("http://localhost/api/hazards", { method: "POST", headers: { "content-type": "application/json", "x-demo-role": role, origin: "http://localhost" }, body: JSON.stringify({ action, input }) });
}

test("new privileged hazard actions reject citizens and crew before reaching storage or photo decoding", async () => {
  await demo(async () => {
    for (const [action, role] of [
      ["requestCommunity", "citizen"], ["banReporter", "citizen"], ["unbanReporter", "ngo"],
      ["assignCouncil", "relief"], ["autoRelief", "ngo"], ["location", "government"],
      ["forgetLocation", "relief"], ["confirmCommunity", "ngo"],
    ]) {
      const result = await POST(request(action, {}, role));
      assert.equal(result.status, 403, `${role} cannot call ${action}`);
      assert.equal(result.headers.get("cache-control"), "no-store");
    }
  });
});

test("new action payloads reject forged recipient IDs, unchecked fields and malformed decision data", async () => {
  await demo(async () => {
    const cases: [string, object, string][] = [
      ["location", { location: { latitude: 91, longitude: 79.8 }, alertsEnabled: true }, "citizen"],
      ["location", { location: { latitude: 6.9, longitude: 79.8 }, actorId: "another-resident" }, "citizen"],
      ["forgetLocation", { recipientId: "another-resident" }, "citizen"],
      ["requestCommunity", { id: "case-1", notes: "Review safely", recipientIds: ["target"] }, "government"],
      ["confirmCommunity", { invitationId: "invite", location: { latitude: 6.9, longitude: 79.8 }, photo: { dataUrl: "unused" }, notes: "Independent observation", observation: "automatically_confirm", recipientId: "target" }, "citizen"],
      ["banReporter", { reporterId: "target", caseId: "case-1", reason: "" }, "government"],
      ["unbanReporter", { reporterId: "target", reason: "Review complete", liftedBy: "someone-else" }, "government"],
      ["assignCouncil", { id: "case-1", councilId: "a", councilName: "Council A", notes: "Move assignment", status: "resolved" }, "government"],
      ["autoRelief", { id: "case-1", organization: "Relief team", resources: "Food and shelter", people: 1001 }, "relief"],
      ["review", { id: "case-1", decision: "confirmed", notes: "Officer assessment", urgency: "immediate" }, "government"],
    ];
    for (const [action, input, role] of cases) {
      const result = await POST(request(action, input, role));
      assert.equal(result.status, 400, `${action} rejects invalid input`);
      assert.equal(result.headers.get("cache-control"), "no-store");
    }
  });
});

test("all new write actions still require a verified session outside local demo mode", async () => {
  const savedPool = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-south-1_configured";
  try {
    const result = await POST(request("banReporter", { reporterId: "target", caseId: "case-1", reason: "Forged demo authority" }, "government"));
    assert.equal(result.status, 401);
  } finally { if (savedPool === undefined) delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID; else process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = savedPool; }
});

test("public map endpoint exposes only GET and applies a per-address abuse guard", () => {
  assert.equal(typeof publicApi.GET, "function");
  assert.equal("POST" in publicApi, false);
  const request = new Request("http://localhost/api/hazards/public", { headers: { "x-forwarded-for": "192.0.2.31" } });
  for (let index = 0; index < 120; index++) limitPublicHazardRead(request);
  assert.throws(() => limitPublicHazardRead(request), /Too many requests/);
  assert.doesNotThrow(() => limitPublicHazardRead(new Request(request.url, { headers: { "x-forwarded-for": "192.0.2.32" } })));
});

test("photo confirmation and automatic allocation retain lower action rate limits", () => {
  for (const action of ["confirmCommunity", "autoRelief", "requestCommunity", "banReporter"]) {
    const actor = randomUUID();
    for (let index = 0; index < 12; index++) limitHazardAction(actor, action);
    assert.throws(() => limitHazardAction(actor, action), /Too many requests/);
  }
});
