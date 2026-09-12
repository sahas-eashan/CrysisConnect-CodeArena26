import assert from "node:assert/strict";
import test from "node:test";
import { attachRoutesToAlerts, recipientIdsForAlert, type AlertRouteCache, type RoutedAreaAlert } from "../src/lib/hazards/alert-routing";
import type { AreaAlert, SafeRoute } from "../src/lib/hazards/types";

const now = Date.parse("2026-09-12T08:00:00Z");
const iso = (time = now) => new Date(time).toISOString();
const origin = { latitude: 6.9, longitude: 79.8 };
function alert(id = "alert-1", kind: AreaAlert["kind"] = "hazard_confirmed"): AreaAlert {
  return { id, caseId: "case-1", kind, title: "Area warning", message: "Avoid the affected area", location: origin, radiusM: 2000, createdAt: iso(now - 1000), expiresAt: iso(now + 60_000) };
}
function available(): SafeRoute {
  return { status: "available", reason: "Screened road route", coordinates: [[79.8, 6.9], [79.81, 6.9]], shelter: { id: "shelter-1", name: "Relief centre", location: { latitude: 6.9, longitude: 79.81 }, available: 5, capacity: 10, fixture: false }, distanceM: 1200, durationSeconds: 180, screenedHazardIds: ["case-1"], checkedAt: iso(), limitations: ["Unreported hazards are unknown."] };
}

test("all active alerts receive one automatically screened route without a separate route request", async () => {
  let calls = 0;
  const expired = { ...alert("expired"), expiresAt: iso(now - 1) };
  const resolved: RoutedAreaAlert = { ...alert("resolved", "hazard_resolved"), route: available() };
  const input = [alert(), alert("weather", "weather_warning"), expired, resolved];
  const result = await attachRoutesToAlerts({ alerts: input, origin, now, contextKey: "state-1", planRoute: async point => { calls++; assert.deepEqual(point, origin); return available(); } });
  assert.equal(calls, 1);
  assert.equal(result[0].route?.status, "available");
  assert.deepEqual(result[1].route, result[0].route);
  assert.equal(result[2].route, undefined);
  assert.equal(result[3].route, undefined);
  result[0].route!.coordinates[0][0] = 0;
  assert.equal(result[1].route!.coordinates[0][0], 79.8, "One alert cannot mutate another alert's geometry.");
  assert.equal(input[0].route, undefined, "Input state is not mutated.");
});

test("automatic area delivery requires opt-in, proximity and a current location", () => {
  const recipients = [
    { id: "nearby", alertsEnabled: true, location: { latitude: 6.91, longitude: 79.8 }, locationUpdatedAt: iso() },
    { id: "nearby", alertsEnabled: true, location: origin, locationUpdatedAt: iso() },
    { id: "far", alertsEnabled: true, location: { latitude: 7.2, longitude: 79.8 }, locationUpdatedAt: iso() },
    { id: "opted-out", alertsEnabled: false, location: origin, locationUpdatedAt: iso() },
    { id: "unknown", alertsEnabled: true },
    { id: "stale", alertsEnabled: true, location: origin, locationUpdatedAt: iso(now - 24 * 60 * 60_000 - 1) },
    { id: "future", alertsEnabled: true, location: origin, locationUpdatedAt: iso(now + 1) },
    { id: "invalid", alertsEnabled: true, location: { latitude: NaN, longitude: 79.8 }, locationUpdatedAt: iso() },
  ];
  assert.deepEqual(recipientIdsForAlert(alert(), recipients, now), ["nearby"]);
  assert.deepEqual(recipientIdsForAlert({ ...alert(), expiresAt: iso() }, recipients, now), []);
});

test("missing GPS and unavailable providers produce explicit failure status without fabricated routes", async () => {
  let calls = 0;
  const planRoute = async () => { calls++; throw new Error("Provider timeout"); };
  const missing = await attachRoutesToAlerts({ alerts: [alert()], now, contextKey: "state-1", planRoute });
  assert.equal(calls, 0);
  assert.equal(missing[0].route?.status, "unavailable");
  assert.match(missing[0].route!.reason, /location/);
  const failed = await attachRoutesToAlerts({ alerts: [alert()], origin, now, contextKey: "state-1", planRoute });
  assert.equal(calls, 1);
  assert.equal(failed[0].route?.status, "unavailable");
  assert.deepEqual(failed[0].route?.coordinates, []);
  assert.equal(failed[0].route?.shelter, undefined);
});

test("stale, future-dated and malformed routes are discarded", async () => {
  for (const route of [
    { ...available(), checkedAt: iso(now - 30_001) },
    { ...available(), checkedAt: iso(now + 1) },
    { ...available(), checkedAt: "invalid" },
    { ...available(), coordinates: [[79.8, 6.9]] as [number, number][] },
    { ...available(), coordinates: [[79.8, 6.9], [181, 6.9]] as [number, number][] },
    { ...available(), shelter: { ...available().shelter!, available: 0 } },
  ]) {
    const result = await attachRoutesToAlerts({ alerts: [alert()], origin, now, contextKey: "state-1", planRoute: async () => route });
    assert.equal(result[0].route?.status, "unavailable");
    assert.deepEqual(result[0].route?.coordinates, []);
  }
});

test("one origin/context shares concurrent planning while changed hazards, location and age require a fresh route", async () => {
  const cache: AlertRouteCache = new Map();
  let calls = 0;
  let currentTime = now;
  const planRoute = async () => { calls++; return { ...available(), checkedAt: iso(currentTime) }; };
  const options = { alerts: [alert()], origin, now, contextKey: "hazards-1-shelters-1-legacy-1", cache, planRoute };
  await Promise.all([attachRoutesToAlerts(options), attachRoutesToAlerts(options)]);
  assert.equal(calls, 1);
  await attachRoutesToAlerts({ ...options, contextKey: "hazards-2-shelters-1-legacy-1" });
  assert.equal(calls, 2);
  await attachRoutesToAlerts({ ...options, origin: { latitude: 6.900001, longitude: 79.8 } });
  assert.equal(calls, 3, "Coordinates are not rounded across a hazard boundary.");
  currentTime = now + 30_001;
  await attachRoutesToAlerts({ ...options, now: currentTime });
  assert.equal(calls, 4);
});

test("failed planning retries on the next refresh and old geometry never survives closure", async () => {
  const cache: AlertRouteCache = new Map();
  let calls = 0;
  const options = { alerts: [alert()], origin, now, contextKey: "context", cache, planRoute: async () => { if (++calls === 1) throw new Error("Transient outage"); return available(); } };
  assert.equal((await attachRoutesToAlerts(options))[0].route?.status, "unavailable");
  const recovered = await attachRoutesToAlerts(options);
  assert.equal(recovered[0].route?.status, "available");
  const closed = await attachRoutesToAlerts({ ...options, alerts: [{ ...recovered[0], kind: "hazard_resolved" }] });
  assert.equal(closed[0].route, undefined);
  assert.equal(calls, 2);
});

test("network planning uses its completion time and drops warnings that expired while awaiting the provider", async () => {
  const completedAt = now + 12_000;
  const result = await attachRoutesToAlerts({
    alerts: [alert(), { ...alert("expires-during-planning"), expiresAt: iso(now + 1000) }],
    origin, now, clock: () => completedAt, contextKey: "current",
    planRoute: async () => ({ ...available(), checkedAt: iso(completedAt) }),
  });
  assert.equal(result[0].route?.status, "available", "A route checked after the snapshot began is current at completion.");
  assert.equal(result[1].route, undefined);
});
