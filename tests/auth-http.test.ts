import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticateRequest, demoEnabled, requireSameOrigin, roleFromClaims } from "../src/lib/server-auth";
import { readHazardBody } from "../src/lib/hazards/http";

test("privileged roles come only from groups, never a self-asserted custom role", () => {
  assert.equal(roleFromClaims({ "custom:role": "government" }), "citizen");
  assert.equal(roleFromClaims({ "cognito:groups": ["ngo_individual"] }), "ngo");
  assert.equal(roleFromClaims({ "cognito:groups": ["citizen", "government"] }), "government");
  assert.equal(roleFromClaims({ "cognito:groups": "government" }), "citizen");
});

test("a forged legacy role cookie or demo header cannot authenticate a live user", async () => {
  const previousPool = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const previousDemo = process.env.HAZARD_DEMO_MODE;
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "ap-south-1_test";
  process.env.HAZARD_DEMO_MODE = "true";
  try {
    assert.equal(demoEnabled(), false);
    await assert.rejects(authenticateRequest(new Request("http://localhost/api/hazards", {
      headers: { cookie: "cc-role=government", "x-demo-role": "government" }
    })), /Sign in/);
  } finally {
    if (previousPool === undefined) delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID; else process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = previousPool;
    if (previousDemo === undefined) delete process.env.HAZARD_DEMO_MODE; else process.env.HAZARD_DEMO_MODE = previousDemo;
  }
});

test("cross-origin mutations are refused", () => {
  assert.throws(() => requireSameOrigin(new Request("https://crisis.example/api/hazards", { headers: { origin: "https://attacker.example" } })), /Cross-origin/);
  assert.doesNotThrow(() => requireSameOrigin(new Request("https://crisis.example/api/hazards", { headers: { origin: "https://crisis.example" } })));
  assert.doesNotThrow(() => requireSameOrigin(new Request("http://localhost:3100/api/hazards", { headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" } })));
  assert.throws(() => requireSameOrigin(new Request("http://localhost:3100/api/hazards", { headers: { host: "127.0.0.1:3100", origin: "http://attacker.example" } })), /Cross-origin/);
});

test("malformed and oversized HTTP uploads are rejected before domain actions", async () => {
  await assert.rejects(readHazardBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })), /Malformed/);
  await assert.rejects(readHazardBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "content-length": "7000000" }, body: "{}" })), /6 MB/);
  const parsed = await readHazardBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "route", input: { location: { latitude: 7, longitude: 80 } } }) }));
  assert.equal(parsed.action, "route");
});
