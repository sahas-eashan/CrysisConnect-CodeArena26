import { distanceM } from "./engine";
import type { AreaAlert, GeoPoint, SafeRoute } from "./types";

export type RoutedAreaAlert = AreaAlert & { route?: SafeRoute };
export type AlertRecipient = { id: string; alertsEnabled: boolean; location?: GeoPoint; locationUpdatedAt?: string };
type CachedRoute = { startedAt: number; result: Promise<SafeRoute> };
export type AlertRouteCache = Map<string, CachedRoute>;
const DEFAULT_MAX_AGE_MS = 30_000;

function validPoint(point: GeoPoint | undefined): point is GeoPoint {
  return !!point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

function active(alert: AreaAlert, now: number): boolean {
  return Number.isFinite(Date.parse(alert.createdAt)) && Date.parse(alert.createdAt) <= now && Date.parse(alert.expiresAt) > now;
}

/** Only explicit subscriptions with a recently supplied location receive area delivery. */
export function recipientIdsForAlert(alert: AreaAlert, recipients: AlertRecipient[], now: number, maxLocationAgeMs = 24 * 60 * 60_000): string[] {
  if (!active(alert, now) || !validPoint(alert.location) || !Number.isFinite(alert.radiusM) || alert.radiusM < 0) return [];
  return [...new Set(recipients.filter(recipient => {
    const age = now - Date.parse(recipient.locationUpdatedAt || "");
    return recipient.alertsEnabled && recipient.id && validPoint(recipient.location) && age >= 0 && age <= maxLocationAgeMs && distanceM(recipient.location, alert.location) <= alert.radiusM;
  }).map(recipient => recipient.id))];
}

function unavailable(reason: string, now: number, prior?: SafeRoute): SafeRoute {
  return {
    status: "unavailable", reason, coordinates: [], checkedAt: new Date(now).toISOString(),
    screenedHazardIds: prior?.screenedHazardIds || [],
    limitations: prior?.limitations || ["No current road route has been verified. Follow responder instructions and request assistance if you are in danger."],
  };
}

function currentRoute(route: SafeRoute, now: number, maxAgeMs: number): SafeRoute {
  const age = now - Date.parse(route.checkedAt);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return unavailable("The route check is out of date. A fresh route must be screened before travel.", now, route);
  if (route.status !== "available") return { ...route, coordinates: [], shelter: undefined, distanceM: undefined, durationSeconds: undefined };
  if (!route.shelter || !validPoint(route.shelter.location) || route.shelter.available <= 0 || route.coordinates.length < 2 || route.coordinates.length > 20_000 || !route.coordinates.every(point => Array.isArray(point) && point.length === 2 && validPoint({ longitude: point[0], latitude: point[1] }))) {
    return unavailable("The route provider returned an incomplete route. No substitute path has been generated.", now, route);
  }
  return route;
}

/**
 * Attach one current, screened route to every active warning/confirmation in a snapshot.
 * A cache is optional. Its contextKey MUST cover every hazard boundary, shelter state and
 * warning expiry used by the planner (including legacy boundaries). Without such a complete
 * fingerprint, omit the cache so each snapshot is screened against current records.
 */
export async function attachRoutesToAlerts(options: {
  alerts: AreaAlert[];
  origin?: GeoPoint;
  planRoute: (origin: GeoPoint) => Promise<SafeRoute>;
  now: number;
  /** Service clock, evaluated after network planning; omit only with a fixed test clock. */
  clock?: () => number;
  contextKey: string;
  cache?: AlertRouteCache;
  maxAgeMs?: number;
}): Promise<RoutedAreaAlert[]> {
  const { alerts, origin, planRoute, now, contextKey, cache } = options;
  const maxAgeMs = Math.min(DEFAULT_MAX_AGE_MS, Math.max(1, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS));
  const eligible = (alert: AreaAlert, at = now) => active(alert, at) && alert.kind !== "hazard_resolved";
  // Always remove any previously attached geometry; closure/expiry cannot retain a route.
  const clean = alerts.map(alert => { const { route: _oldRoute, ...rest } = alert as RoutedAreaAlert; return rest; });
  if (!clean.some(alert => eligible(alert))) return clean;
  let route: SafeRoute;
  let completedAt = now;
  if (!validPoint(origin)) {
    route = unavailable("Share your current location to receive a route with this area alert.", now);
  } else {
    const key = JSON.stringify([origin.latitude, origin.longitude, contextKey]);
    for (const [entryKey, entry] of cache || []) if (now < entry.startedAt || now - entry.startedAt > maxAgeMs) cache!.delete(entryKey);
    let result = cache?.get(key)?.result;
    if (!result) {
      result = Promise.resolve().then(() => planRoute(origin)).catch(() => unavailable("Automatic route screening is unavailable. No substitute route has been generated; request responder assistance if needed.", options.clock?.() ?? now));
      if (cache) {
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { startedAt: now, result });
      }
    }
    const planned = await result;
    completedAt = options.clock?.() ?? now;
    route = currentRoute(planned, completedAt, maxAgeMs);
    // Failed planning is retried on the next refresh instead of caching a transient outage.
    if (route.status === "unavailable") cache?.delete(key);
  }
  return clean.map(alert => eligible(alert, completedAt) ? { ...alert, route: structuredClone(route) } : alert);
}
