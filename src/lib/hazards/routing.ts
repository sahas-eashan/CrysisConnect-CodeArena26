import { distanceM } from "./engine";
import type { GeoPoint, SafeRoute, Shelter } from "./types";

export type RouteExclusion = { id: string; location: GeoPoint; radiusM: number };
export type RouteCandidate = { coordinates: [number, number][]; distanceM: number; durationSeconds: number };
export type RouteProvider = (origin: GeoPoint, shelter: Shelter) => Promise<RouteCandidate[]>;
const EARTH_M = 6_371_000;
const radians = (number: number) => number * Math.PI / 180;

function bearing(a: GeoPoint, b: GeoPoint): number {
  const dLon = radians(b.longitude - a.longitude);
  return Math.atan2(Math.sin(dLon) * Math.cos(radians(b.latitude)), Math.cos(radians(a.latitude)) * Math.sin(radians(b.latitude)) - Math.sin(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.cos(dLon));
}

/** Minimum great-circle distance to the entire segment, not just its vertices. */
export function distanceToSegmentM(point: GeoPoint, start: GeoPoint, end: GeoPoint): number {
  const length = distanceM(start, end);
  if (length < 0.01) return distanceM(point, start);
  const angular = distanceM(start, point) / EARTH_M;
  const bearingDelta = bearing(start, point) - bearing(start, end);
  const along = Math.atan2(Math.sin(angular) * Math.cos(bearingDelta), Math.cos(angular)) * EARTH_M;
  if (along < 0 || along > length) return Math.min(distanceM(point, start), distanceM(point, end));
  return Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(angular) * Math.sin(bearingDelta)))) * EARTH_M);
}

export function routeIntersectsHazard(coordinates: [number, number][], hazard: RouteExclusion, extraBufferM = 50): boolean {
  for (let index = 1; index < coordinates.length; index++) {
    const start = { longitude: coordinates[index - 1][0], latitude: coordinates[index - 1][1] };
    const end = { longitude: coordinates[index][0], latitude: coordinates[index][1] };
    if (distanceToSegmentM(hazard.location, start, end) <= hazard.radiusM + extraBufferM) return true;
  }
  return false;
}

export const fetchOsrmCandidates: RouteProvider = async (origin, shelter) => {
  const base = process.env.OSRM_BASE_URL || ((process.env.NODE_ENV !== "production" || process.env.HAZARD_DEMO_MODE === "true") ? "https://router.project-osrm.org" : "");
  if (!base) throw new Error("Routing provider is not configured.");
  const endpoint = new URL(base);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("Invalid routing provider configuration.");
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/route/v1/driving/${origin.longitude},${origin.latitude};${shelter.location.longitude},${shelter.location.latitude}`;
  endpoint.search = "alternatives=true&overview=full&geometries=geojson&steps=false&radiuses=100;100";
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok || Number(response.headers.get("content-length")) > 4 * 1024 * 1024) throw new Error("Routing provider failed.");
  const raw = await response.text();
  if (raw.length > 4 * 1024 * 1024) throw new Error("Routing response is too large.");
  const body = JSON.parse(raw) as { code?: string; routes?: { distance?: unknown; duration?: unknown; geometry?: { type?: string; coordinates?: unknown } }[] };
  if (body.code !== "Ok" || !Array.isArray(body.routes)) return [];
  return body.routes.slice(0, 5).flatMap(route => {
    const coordinates = route.geometry?.coordinates;
    if (route.geometry?.type !== "LineString" || !Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 20_000 || !coordinates.every(point => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)) return [];
    if (typeof route.distance !== "number" || !Number.isFinite(route.distance) || route.distance < 0 || typeof route.duration !== "number" || !Number.isFinite(route.duration) || route.duration < 0) return [];
    return [{ coordinates: coordinates as [number, number][], distanceM: route.distance, durationSeconds: route.duration }];
  });
};

export async function selectScreenedRoute(origin: GeoPoint, shelters: Shelter[], exclusions: RouteExclusion[], now: number, provider: RouteProvider = fetchOsrmCandidates, additionalScreen: (coordinates: [number, number][]) => boolean = () => true): Promise<SafeRoute> {
  const base: SafeRoute = {
    status: "unavailable", reason: "No route could be verified against the known hazard buffers.", coordinates: [],
    screenedHazardIds: exclusions.map(hazard => hazard.id), checkedAt: new Date(now).toISOString(),
    limitations: ["Screened against recorded confirmed hazards and active weather warnings, with an extra 50 m buffer. Unreported hazards and live road conditions are unknown.", "This is a driving route. Road access and the final approach to the shelter need local confirmation; follow emergency responder instructions."],
  };
  if (exclusions.some(hazard => distanceM(origin, hazard.location) <= hazard.radiusM + 50)) return { ...base, reason: "Your position is inside a recorded hazard buffer. An ordinary road route cannot establish a safe exit; request responder assistance." };
  const destinations = shelters.filter(shelter => shelter.available > 0 && distanceM(origin, shelter.location) <= 50_000 && !exclusions.some(hazard => distanceM(shelter.location, hazard.location) <= hazard.radiusM + 50)).sort((a, b) => distanceM(origin, a.location) - distanceM(origin, b.location)).slice(0, 3);
  if (!destinations.length) return { ...base, reason: "No shelter with available capacity outside the known hazard buffers is configured within 50 km." };
  const results = await Promise.allSettled(destinations.map(async shelter => ({ shelter, routes: await provider(origin, shelter) })));
  const safe: { shelter: Shelter; route: RouteCandidate }[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const route of result.value.routes) {
      if (route.coordinates.length < 2) continue;
      const first = route.coordinates[0], last = route.coordinates[route.coordinates.length - 1];
      if (distanceM(origin, { longitude: first[0], latitude: first[1] }) > 100 || distanceM(result.value.shelter.location, { longitude: last[0], latitude: last[1] }) > 100) continue;
      // Screen even the short snapped-endpoint approaches, without fabricating road geometry for them.
      const screened: [number, number][] = [[origin.longitude, origin.latitude], ...route.coordinates, [result.value.shelter.location.longitude, result.value.shelter.location.latitude]];
      if (!exclusions.some(hazard => routeIntersectsHazard(screened, hazard)) && additionalScreen(screened)) safe.push({ shelter: result.value.shelter, route });
    }
  }
  const selected = safe.sort((a, b) => a.route.durationSeconds - b.route.durationSeconds)[0];
  if (!selected) return { ...base, reason: results.every(result => result.status === "rejected") ? "The routing provider is unavailable or not configured. No substitute route has been generated." : "All returned road routes cross a known hazard buffer, end too far from the requested points, or were unavailable. No screened route is available." };
  return { ...base, status: "available", reason: selected.shelter.fixture ? "Demo route to a fixture shelter, screened against the current recorded hazards. This destination is not a verified operating shelter." : "The returned road route avoids the current recorded hazard buffers. Confirm road access and shelter operation with responders.", ...selected.route, shelter: selected.shelter };
}
