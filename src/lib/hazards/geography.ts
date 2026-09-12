import { readFileSync, statSync } from "node:fs";
import { z } from "zod";
import demoGeography from "./geography.demo.json";
import type { GeoPoint } from "./types";

export type HazardGeography = {
  status: "mapped" | "outside_coverage" | "unconfigured" | "ambiguous";
  fixture: boolean;
  source: string;
  ward?: { id: string; name: string };
  council?: { id: string; name: string };
  road?: { id: string; name: string; distanceM: number };
  reason: string;
};

const identifier = z.string().trim().min(1).max(160);
const coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-85).max(85)]);
const line = z.array(coordinate).min(2).max(50_000).refine(points => points.every((point, index) => index === 0 || Math.abs(point[0] - points[index - 1][0]) < 180), "Antimeridian crossings are unsupported.");
const ring = line.refine(points => points.length >= 4 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1], "Polygon rings must be closed and have at least four coordinates.");
const polygon = z.array(ring).min(1).max(1000);
const ward = z.object({
  type: z.literal("Feature"),
  properties: z.object({ kind: z.literal("ward"), id: identifier, name: identifier, councilId: identifier, councilName: identifier }),
  geometry: z.discriminatedUnion("type", [z.object({ type: z.literal("Polygon"), coordinates: polygon }), z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(polygon).min(1).max(1000) })]),
});
const road = z.object({
  type: z.literal("Feature"),
  properties: z.object({ kind: z.literal("road"), id: identifier, name: identifier }),
  geometry: z.discriminatedUnion("type", [z.object({ type: z.literal("LineString"), coordinates: line }), z.object({ type: z.literal("MultiLineString"), coordinates: z.array(line).min(1).max(1000) })]),
});
const configSchema = z.object({
  type: z.literal("FeatureCollection"), source: z.string().trim().min(5).max(1000),
  fixture: z.boolean().default(false), verified: z.boolean(),
  roadMatchMaxDistanceM: z.number().finite().positive().max(5000).default(500),
  features: z.array(z.union([ward, road])).min(1).max(20_000),
}).superRefine((config, context) => {
  const ids = new Set<string>();
  const councilNames = new Map<string, string>();
  for (const feature of config.features) {
    const key = `${feature.properties.kind}:${feature.properties.id}`;
    if (ids.has(key)) context.addIssue({ code: "custom", message: "Feature IDs must be unique within each kind." });
    ids.add(key);
    if (feature.properties.kind === "ward") {
      const { councilId, councilName } = feature.properties;
      if (councilNames.has(councilId) && councilNames.get(councilId) !== councilName) context.addIssue({ code: "custom", message: "Council IDs must have consistent names." });
      councilNames.set(councilId, councilName);
    }
  }
  if (!config.features.some(feature => feature.properties.kind === "ward")) context.addIssue({ code: "custom", message: "At least one ward boundary is required." });
});

type Coordinate = z.infer<typeof coordinate>;
type GeographyOptions = { demo?: boolean; config?: unknown };

function configuredGeography(options: GeographyOptions): z.infer<typeof configSchema> | undefined {
  let input = options.config;
  if (input === undefined) {
    if (process.env.HAZARD_GEOGRAPHY_JSON) {
      if (Buffer.byteLength(process.env.HAZARD_GEOGRAPHY_JSON) > 10 * 1024 * 1024) throw new Error("Geography configuration exceeds size limit.");
      input = JSON.parse(process.env.HAZARD_GEOGRAPHY_JSON);
    } else if (process.env.HAZARD_GEOGRAPHY_FILE) {
      if (statSync(process.env.HAZARD_GEOGRAPHY_FILE).size > 10 * 1024 * 1024) throw new Error("Geography configuration exceeds size limit.");
      input = JSON.parse(readFileSync(process.env.HAZARD_GEOGRAPHY_FILE, "utf8"));
    } else if (options.demo) input = demoGeography;
    else return undefined;
  }
  const config = configSchema.parse(input);
  if (config.fixture && !options.demo || !config.fixture && !config.verified) throw new Error("Live geography requires verified, non-fixture data.");
  return config;
}

export function geographyCatalog(options: GeographyOptions = {}): { councils: { id: string; name: string }[]; wards: { id: string; name: string; councilId: string }[] } {
  try {
    const config = configuredGeography(options);
    const councils = new Map<string, { id: string; name: string }>();
    const wards: { id: string; name: string; councilId: string }[] = [];
    for (const feature of config?.features ?? []) {
      const properties = feature.properties;
      if (properties.kind !== "ward") continue;
      councils.set(properties.councilId, { id: properties.councilId, name: properties.councilName });
      wards.push({ id: properties.id, name: properties.name, councilId: properties.councilId });
    }
    return { councils: [...councils.values()].sort((a, b) => a.name.localeCompare(b.name)), wards: wards.sort((a, b) => a.name.localeCompare(b.name)) };
  } catch { return { councils: [], wards: [] }; }
}

/** Returns interior/boundary/outside separately so administrative boundary ties remain visible. */
function inRing(point: Coordinate, points: Coordinate[]): "inside" | "boundary" | "outside" {
  let inside = false;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) < 1e-12 && point[0] >= Math.min(a[0], b[0]) - 1e-12 && point[0] <= Math.max(a[0], b[0]) + 1e-12 && point[1] >= Math.min(a[1], b[1]) - 1e-12 && point[1] <= Math.max(a[1], b[1]) + 1e-12) return "boundary";
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

function inPolygon(point: Coordinate, rings: Coordinate[][]): boolean {
  if (inRing(point, rings[0]) === "outside") return false;
  // A point on a hole edge belongs to the boundary, while the hole interior does not.
  return !rings.slice(1).some(hole => inRing(point, hole) === "inside");
}

function segmentDistanceM(point: GeoPoint, a: Coordinate, b: Coordinate): number {
  // A local metric projection measures the nearest point on each complete road segment.
  const meters = Math.PI * 6_371_000 / 180;
  const longitudeScale = meters * Math.cos(point.latitude * Math.PI / 180);
  const ax = (a[0] - point.longitude) * longitudeScale, ay = (a[1] - point.latitude) * meters;
  const bx = (b[0] - point.longitude) * longitudeScale, by = (b[1] - point.latitude) * meters;
  const dx = bx - ax, dy = by - ay;
  const fraction = dx * dx + dy * dy ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(ax + fraction * dx, ay + fraction * dy);
}

/** Server-only administrative lookup. Live data must explicitly carry an operator's verified flag. */
export function resolveGeography(point: GeoPoint, options: GeographyOptions = {}): HazardGeography {
  const unavailable = (reason: string): HazardGeography => ({ status: "unconfigured", fixture: false, source: "No usable configured geography", reason });
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 85 || Math.abs(point.longitude) > 180) return unavailable("This coordinate is outside the supported administrative lookup range.");
  try {
    const config = configuredGeography(options);
    if (!config) return unavailable("Configure verified ward boundaries, council identifiers and road geometries to assign a responsible council.");
    const base = { fixture: config.fixture, source: config.source };
    const coordinate: Coordinate = [point.longitude, point.latitude];
    const matches = config.features.filter((feature): feature is z.infer<typeof ward> => feature.properties.kind === "ward").filter(feature => {
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      return polygons.some(rings => inPolygon(coordinate, rings));
    });
    if (!matches.length) return { ...base, status: "outside_coverage", reason: "No configured ward covers this point; a reviewer must determine the responsible council." };
    if (matches.length > 1) return { ...base, status: "ambiguous", reason: "This point falls on a shared ward boundary or overlapping wards; a reviewer must resolve the responsible council." };
    const properties = matches[0].properties;
    let nearest: HazardGeography["road"];
    for (const feature of config.features) {
      if (feature.geometry.type !== "LineString" && feature.geometry.type !== "MultiLineString") continue;
      const lines = feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const points of lines) for (let index = 1; index < points.length; index++) {
        const distance = segmentDistanceM(point, points[index - 1], points[index]);
        if (distance <= config.roadMatchMaxDistanceM && (!nearest || distance < nearest.distanceM)) nearest = { id: feature.properties.id, name: feature.properties.name, distanceM: distance };
      }
    }
    if (nearest) nearest.distanceM = Math.round(nearest.distanceM);
    return { ...base, status: "mapped", ward: { id: properties.id, name: properties.name }, council: { id: properties.councilId, name: properties.councilName }, road: nearest,
      reason: `${config.fixture ? "Synthetic demo boundaries" : "Configured verified boundaries"} assign this point to ${properties.name} and ${properties.councilName}. ${nearest ? `The nearest configured road is ${nearest.name}; proximity does not prove the incident is on that road.` : `No configured road is within ${config.roadMatchMaxDistanceM} metres.`}` };
  } catch { return unavailable("The configured geography could not be loaded; a reviewer must determine the responsible council."); }
}
