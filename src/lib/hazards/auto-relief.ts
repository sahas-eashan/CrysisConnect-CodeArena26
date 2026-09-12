import { randomUUID } from "node:crypto";
import { z } from "zod";
import { distanceM } from "./engine";
import { caseForActor } from "./case-visibility";
import { normalizePolygonExclusions, pointAvoidsPolygons, routeAvoidsPolygons } from "./polygon-safety";
import { routeIntersectsHazard, type RouteCandidate, type RouteExclusion, type RouteProvider } from "./routing";
import type { HazardStore } from "./store";
import type { GeoPoint, HazardActor, HazardCase, HazardState, SafeRoute, Shelter } from "./types";
import { actorSchema, HazardError, parse, routeCoordinatesSchema } from "./validation";

export const automaticReliefSchema = z.object({
  organization: z.string().trim().min(2).max(160), resources: z.string().trim().min(3).max(2000), people: z.number().int().min(1).max(1000),
}).strict();
export type AutomaticReliefInput = z.infer<typeof automaticReliefSchema>;

const candidateSchema = z.object({ coordinates: routeCoordinatesSchema, distanceM: z.number().finite().nonnegative(), durationSeconds: z.number().finite().nonnegative() });
type Legacy = { id: string; geometry: unknown }[];
type Dependencies = {
  store: HazardStore;
  now: () => number;
  routeProvider: RouteProvider;
  exclusions: (state: HazardState, now: number) => RouteExclusion[];
  assertCaseAccess: (actor: HazardActor, item: HazardCase) => void;
};

function openCase(state: HazardState, id: string, actor: HazardActor, assertAccess: Dependencies["assertCaseAccess"]): HazardCase {
  const item = state.cases.find(candidate => candidate.id === id);
  if (!item) throw new HazardError("Case not found.", 404, "NOT_FOUND");
  assertAccess(actor, item);
  if (item.status === "rejected" || item.status === "resolved") throw new HazardError("Automatic relief can be allocated only to open cases.", 409, "INVALID_TRANSITION");
  if (!item.helpRequested) throw new HazardError("This case has no assistance request.", 409, "NO_HELP_REQUEST");
  return item;
}

async function loadLegacy(store: HazardStore): Promise<Legacy> {
  let legacy: Legacy;
  try { legacy = await store.legacyHazards(); }
  catch { throw new HazardError("Shelter allocation is unavailable because existing disaster boundaries could not be loaded.", 503, "LEGACY_HAZARDS_UNAVAILABLE"); }
  if (normalizePolygonExclusions(legacy.map(item => item.geometry)) === null) throw new HazardError("An active disaster has an unknown or invalid boundary. Repair it before allocating a shelter.", 503, "LEGACY_HAZARDS_UNAVAILABLE");
  return legacy;
}

function insideHazard(point: GeoPoint, exclusions: RouteExclusion[], legacy: Legacy): boolean {
  return exclusions.some(hazard => distanceM(point, hazard.location) <= hazard.radiusM + 50) || !pointAvoidsPolygons([point.longitude, point.latitude], legacy.map(item => item.geometry));
}

function creditedCapacity(item: HazardCase, shelter: Shelter): number {
  return Math.min(shelter.capacity, shelter.available + (item.relief?.shelterId === shelter.id ? item.relief.people ?? 0 : 0));
}

function destinations(state: HazardState, item: HazardCase, people: number, exclusions: RouteExclusion[], legacy: Legacy): Shelter[] {
  return state.shelters.filter(shelter => creditedCapacity(item, shelter) >= people && distanceM(item.location, shelter.location) <= 50_000 && !insideHazard(shelter.location, exclusions, legacy))
    .sort((a, b) => distanceM(item.location, a.location) - distanceM(item.location, b.location) || a.id.localeCompare(b.id));
}

function screenedCandidate(route: RouteCandidate, origin: GeoPoint, shelter: Shelter, exclusions: RouteExclusion[], legacy: Legacy): boolean {
  const parsed = candidateSchema.safeParse(route);
  if (!parsed.success) return false;
  const first = route.coordinates[0], last = route.coordinates.at(-1)!;
  if (distanceM(origin, { longitude: first[0], latitude: first[1] }) > 100 || distanceM(shelter.location, { longitude: last[0], latitude: last[1] }) > 100) return false;
  // Snapped road endpoints do not exempt either approach from the same full-segment checks.
  const complete: [number, number][] = [[origin.longitude, origin.latitude], ...route.coordinates, [shelter.location.longitude, shelter.location.latitude]];
  return !exclusions.some(hazard => routeIntersectsHazard(complete, hazard)) && routeAvoidsPolygons(complete, legacy.map(item => item.geometry));
}

/** Automatic reservations use the existing serialized capacity ledger; provider calls never hold its lock. */
export function createAutomaticRelief({ store, now, routeProvider, exclusions, assertCaseAccess }: Dependencies) {
  return {
    async autoRelief(actorInput: HazardActor, idInput: string, input: AutomaticReliefInput): Promise<HazardCase> {
      const actor = parse(actorSchema, actorInput), id = parse(z.string().min(1).max(200), idInput), relief = parse(automaticReliefSchema, input);
      if (actor.role !== "government" && actor.role !== "relief") throw new HazardError("Only government officers and relief coordinators can allocate automatic relief.", 403, "FORBIDDEN");
      const initial = await store.read(), initialItem = openCase(initial, id, actor, assertCaseAccess);
      const initialLegacy = await loadLegacy(store), initialExclusions = exclusions(initial, now());
      const eligible = destinations(initial, initialItem, relief.people, initialExclusions, initialLegacy);
      if (!eligible.length) throw new HazardError("No safe shelter within 50 km has enough capacity for this household.", 409, "NO_SHELTER_CAPACITY");

      const routes = new Map<string, { shelter: Shelter; candidates: RouteCandidate[] }>();
      if (!insideHazard(initialItem.location, initialExclusions, initialLegacy)) {
        // Bound concurrent provider work while considering every configured eligible destination.
        // This allows atomic selection of another route if the nearest shelter fills during routing.
        let cursor = 0;
        await Promise.all(Array.from({ length: Math.min(4, eligible.length) }, async () => {
          while (cursor < eligible.length) {
            const shelter = eligible[cursor++];
            try {
              const returned = await routeProvider(initialItem.location, shelter);
              const candidates = Array.isArray(returned) ? returned.slice(0, 5).filter(route => screenedCandidate(route, initialItem.location, shelter, initialExclusions, initialLegacy)) : [];
              routes.set(shelter.id, { shelter, candidates });
            } catch { routes.set(shelter.id, { shelter, candidates: [] }); }
          }
        }));
      }

      // Refresh external boundaries after all network work; internal hazards/capacity are read under the lock below.
      const latestLegacy = await loadLegacy(store);
      return store.transaction(state => {
        const item = openCase(state, id, actor, assertCaseAccess), at = now(), currentExclusions = exclusions(state, at);
        if (distanceM(item.location, initialItem.location) > 1) throw new HazardError("The report location changed during routing. Retry automatic relief.", 409, "CASE_CHANGED");
        const needsExtraction = insideHazard(item.location, currentExclusions, latestLegacy);
        const currentDestinations = destinations(state, item, relief.people, currentExclusions, latestLegacy);
        let selected: Shelter | undefined, selectedRoute: RouteCandidate | undefined;
        for (const shelter of currentDestinations) {
          if (needsExtraction) { selected = shelter; break; }
          const result = routes.get(shelter.id);
          if (!result || distanceM(result.shelter.location, shelter.location) > 1) continue;
          // Compare road alternatives within the nearest routable shelter, never between distant shelters.
          const route = result.candidates.filter(candidate => screenedCandidate(candidate, item.location, shelter, currentExclusions, latestLegacy)).sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
          if (route) { selected = shelter; selectedRoute = route; break; }
        }
        if (!selected) throw new HazardError(currentDestinations.length ? "No road route could be screened to an available shelter. The provider, hazards or capacity may have changed; no reservation was made." : "No safe shelter has enough remaining capacity; no reservation was made.", 409, currentDestinations.length ? "NO_SCREENED_ROUTE" : "NO_SHELTER_CAPACITY");

        // Reassignment restores exactly this case's old reservation and reserves the new places atomically.
        if (item.relief?.shelterId && item.relief.people) {
          const previous = state.shelters.find(shelter => shelter.id === item.relief!.shelterId);
          if (!previous) throw new HazardError("The previously allocated shelter no longer exists. Reconcile its reservation before reallocating relief.", 409, "SHELTER_MISSING");
          previous.available = Math.min(previous.capacity, previous.available + item.relief.people);
        }
        if (selected.available < relief.people) throw new HazardError("The selected shelter has insufficient remaining capacity.", 409, "SHELTER_FULL");
        selected.available -= relief.people;
        const route: SafeRoute = {
          status: needsExtraction ? "unavailable" : "available",
          reason: needsExtraction ? "This reservation requires crew-assisted extraction: the incident is inside a recorded hazard. No ordinary road exit was verified."
            : selected.fixture ? "Demo reservation at the nearest fixture shelter with a screened road route. This is not a verified operating shelter."
              : "Reserved the nearest available shelter with a road route that avoids the recorded hazards. Confirm road access with responders.",
          coordinates: selectedRoute?.coordinates ?? [], distanceM: selectedRoute?.distanceM, durationSeconds: selectedRoute?.durationSeconds,
          shelter: structuredClone(selected), checkedAt: new Date(at).toISOString(),
          screenedHazardIds: [...currentExclusions.map(hazard => hazard.id), ...latestLegacy.map(hazard => `legacy:${hazard.id}`)],
          limitations: ["Recorded confirmed hazards and active warnings use an extra 50 m buffer; active legacy polygons and both endpoint approaches are also screened.", "Unreported hazards and current road access remain unknown. A reservation does not mean people have arrived or that evacuation is safe.", ...(needsExtraction ? ["A response crew must assess and arrange extraction before residents travel; no safe exit coordinates are supplied."] : [])],
        };
        item.relief = { ...relief, shelterId: selected.id, assignedBy: actor.id, assignedAt: new Date(at).toISOString(), route };
        item.revision += 1;
        item.updatedAt = new Date(at).toISOString();
        item.history.push({ id: randomUUID(), at: item.updatedAt, actorId: actor.id, action: "relief_auto_allocated", notes: `${relief.organization}: ${relief.resources}; reserved ${relief.people} place(s) at ${selected.name}. ${route.reason}` });
        return caseForActor(item, actor);
      });
    },
  };
}
