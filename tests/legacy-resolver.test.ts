import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test, mock } from "node:test";
import { handler } from "../lambda/resolver/index";

// Lambda packaging installs its own pg copy. Resolve from the handler's package
// so these mocks always intercept its Pool, with or without nested node_modules.
const resolverRequire = createRequire(new URL("../lambda/resolver/package.json", import.meta.url));
const { Pool } = resolverRequire("pg") as typeof import("pg");

const citizen = { sub: "signed-in-user", claims: { "cognito:groups": ["citizen"] } };
const government = { sub: "duty-officer", claims: { "cognito:groups": ["government"] } };

test("GPS mutation updates only the authenticated profile using validated numeric coordinates", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const stub = mock.method(Pool.prototype, "query", async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    return { rows: [{ id: citizen.sub }] };
  });
  try {
    assert.equal(await handler({ identity: citizen, arguments: { latitude: 6.9, longitude: 79.8, userId: "somebody-else" }, info: { parentTypeName: "Mutation", fieldName: "updateMyLocation" } }), true);
    const update = calls.find((call) => call.sql.includes("UPDATE profiles SET location"));
    assert.deepEqual(update?.values, [citizen.sub, 79.8, 6.9]);
    assert.match(update!.sql, /ST_MakePoint\(\$2, \$3\)/);
    for (const latitude of [91, Infinity, "6.9"]) {
      await assert.rejects(handler({ identity: citizen, arguments: { latitude, longitude: 79.8 }, info: { parentTypeName: "Mutation", fieldName: "updateMyLocation" } }), /Invalid latitude/);
    }
    await assert.rejects(handler({ arguments: { latitude: 6.9, longitude: 79.8 }, info: { parentTypeName: "Mutation", fieldName: "updateMyLocation" } }), /Unauthorized/);
    assert.equal(calls.filter((call) => call.sql.includes("UPDATE profiles SET location")).length, 1);
  } finally { stub.mock.restore(); }
});

test("only government can transition an existing disaster to a validated status", async () => {
  const updates: unknown[][] = [];
  let found = true;
  const stub = mock.method(Pool.prototype, "query", async (sql: string, values: unknown[] = []) => {
    if (sql.includes("UPDATE disasters")) {
      updates.push(values);
      return { rows: found ? [{ id: "hazard", status: values[7] }] : [] };
    }
    return { rows: [] };
  });
  const arguments_ = { id: "hazard", input: { title: "River flood", type: "flood", severity: "high", status: "resolved" } };
  const info = { parentTypeName: "Mutation", fieldName: "updateDisaster" };
  try {
    await assert.rejects(handler({ identity: citizen, arguments: arguments_, info }), /Unauthorized/);
    const result = await handler({ identity: government, arguments: arguments_, info });
    assert.ok(result && typeof result === "object" && "status" in result);
    assert.equal(result.status, "resolved");
    assert.equal(updates[0][7], "resolved");
    await assert.rejects(handler({ identity: government, arguments: { ...arguments_, input: { ...arguments_.input, status: "invented" } }, info }), /Invalid disaster status/);
    found = false;
    await assert.rejects(handler({ identity: government, arguments: arguments_, info }), /Disaster not found/);
  } finally { stub.mock.restore(); }
});

test("GeoJSON accepts numeric geometry and strips arbitrary SQL-bearing properties", async () => {
  let insertSql = "";
  const stub = mock.method(Pool.prototype, "query", async (sql: string) => {
    if (sql.includes("INSERT INTO disasters")) insertSql = sql;
    return { rows: [{ id: "hazard" }] };
  });
  const input = { title: "River flood", type: "flood", severity: "high" };
  const info = { parentTypeName: "Mutation", fieldName: "createDisaster" };
  try {
    await handler({ identity: government, arguments: { input: { ...input, centerPoint: JSON.stringify({ type: "Point", coordinates: [79.8, 6.9], extra: "$$); DROP TABLE profiles; --" }) } }, info });
    assert.doesNotMatch(insertSql, /DROP TABLE|extra/);
    assert.match(insertSql, /coordinates/);
    for (const coordinates of [["$$", 6.9], [181, 6.9], [79.8, 91], [79.8]]) {
      await assert.rejects(handler({ identity: government, arguments: { input: { ...input, centerPoint: JSON.stringify({ type: "Point", coordinates }) } }, info }), /Invalid GeoJSON/);
    }
  } finally { stub.mock.restore(); }
});
