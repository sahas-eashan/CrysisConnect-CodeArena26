export type PolygonPosition = [number, number];

type Bounds = { west: number; south: number; east: number; north: number };
type Ring = { points: PolygonPosition[]; bounds: Bounds };

// Conservative tolerance for geographic coordinates; boundary contact is excluded.
const EPSILON = 1e-10;
const MAX_RING_POINTS = 2048;
const MAX_TOTAL_POLYGON_POINTS = 16384;
const MAX_ROUTE_POINTS = 50000;

function position(value: unknown): value is PolygonPosition {
  return Array.isArray(value) && value.length === 2 &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

function samePoint(a: PolygonPosition, b: PolygonPosition) {
  return a[0] === b[0] && a[1] === b[1];
}

function bounds(points: PolygonPosition[]): Bounds {
  const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const [longitude, latitude] of points) {
    box.west = Math.min(box.west, longitude);
    box.east = Math.max(box.east, longitude);
    box.south = Math.min(box.south, latitude);
    box.north = Math.max(box.north, latitude);
  }
  return box;
}

function boxesOverlap(a: Bounds, b: Bounds) {
  return a.west <= b.east + EPSILON && a.east >= b.west - EPSILON &&
    a.south <= b.north + EPSILON && a.north >= b.south - EPSILON;
}

function cross(a: PolygonPosition, b: PolygonPosition, point: PolygonPosition) {
  return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
}

function onSegment(a: PolygonPosition, b: PolygonPosition, point: PolygonPosition) {
  return Math.abs(cross(a, b, point)) <= EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - EPSILON && point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON && point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function segmentsIntersect(a: PolygonPosition, b: PolygonPosition, c: PolygonPosition, d: PolygonPosition) {
  if (!boxesOverlap(bounds([a, b]), bounds([c, d]))) return false;
  if (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return true;
  return (cross(a, b, c) > 0) !== (cross(a, b, d) > 0) &&
    (cross(c, d, a) > 0) !== (cross(c, d, b) > 0);
}

function insideOrBoundary(point: PolygonPosition, ring: Ring) {
  if (!boxesOverlap(bounds([point]), ring.bounds)) return false;
  let inside = false;
  for (let i = 1; i < ring.points.length; i++) {
    const a = ring.points[i - 1];
    const b = ring.points[i];
    if (onSegment(a, b, point)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
        point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function ringsIntersect(a: Ring, b: Ring) {
  if (!boxesOverlap(a.bounds, b.bounds)) return false;
  for (let i = 1; i < a.points.length; i++) {
    for (let j = 1; j < b.points.length; j++) {
      if (segmentsIntersect(a.points[i - 1], a.points[i], b.points[j - 1], b.points[j])) return true;
    }
  }
  return false;
}

function parseRing(value: unknown): Ring | null {
  if (!Array.isArray(value) || value.length < 4 || value.length > MAX_RING_POINTS || !value.every(position)) return null;
  const points = value.map(([longitude, latitude]): PolygonPosition => [longitude, latitude]);
  if (!samePoint(points[0], points[points.length - 1])) return null;
  const seen = new Set<string>();
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    const key = `${points[i - 1][0]},${points[i - 1][1]}`;
    // Repeated vertices, collapsed edges, and backtracking rings are not accepted.
    if (seen.has(key) || samePoint(points[i - 1], points[i])) return null;
    seen.add(key);
    if (Math.abs(points[i][0] - points[i - 1][0]) > 180) return null;
    area += cross(points[0], points[i - 1], points[i]);
  }
  if (seen.size < 3 || Math.abs(area) <= EPSILON) return null;
  // Reject self intersections, including nonadjacent touches and overlapping edges.
  for (let i = 1; i < points.length; i++) {
    for (let j = i + 2; j < points.length; j++) {
      if (i === 1 && j === points.length - 1) continue;
      if (segmentsIntersect(points[i - 1], points[i], points[j - 1], points[j])) return null;
    }
  }
  return { points, bounds: bounds(points) };
}

/**
 * Returns validated exterior exclusion rings, or null when any geometry is unknown.
 * Accepts GeoJSON Polygon/MultiPolygon objects and ST_AsGeoJSON JSON strings.
 * Holes are validated but conservatively remain excluded along with their exterior.
 * Antimeridian geometry is rejected because this screen uses planar GeoJSON segments.
 */
export function normalizePolygonExclusions(polygons: unknown[]): PolygonPosition[][] | null {
  if (!Array.isArray(polygons)) return null;
  const exclusions: PolygonPosition[][] = [];
  let totalPoints = 0;
  try {
    for (const raw of polygons) {
      const geometry = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!geometry || typeof geometry !== "object") return null;
      const coordinates = geometry.type === "Polygon" ? [geometry.coordinates]
        : geometry.type === "MultiPolygon" ? geometry.coordinates : null;
      if (!Array.isArray(coordinates) || coordinates.length === 0) return null;
      for (const polygon of coordinates) {
        if (!Array.isArray(polygon) || polygon.length === 0) return null;
        const rings: Ring[] = [];
        for (const candidate of polygon) {
          totalPoints += Array.isArray(candidate) ? candidate.length : 0;
          if (totalPoints > MAX_TOTAL_POLYGON_POINTS) return null;
          const ring = parseRing(candidate);
          if (!ring) return null;
          rings.push(ring);
        }
        const exterior = rings[0];
        for (let i = 1; i < rings.length; i++) {
          const hole = rings[i];
          if (!insideOrBoundary(hole.points[0], exterior) || ringsIntersect(hole, exterior)) return null;
          for (let j = 1; j < i; j++) {
            if (ringsIntersect(hole, rings[j]) || insideOrBoundary(hole.points[0], rings[j]) || insideOrBoundary(rings[j].points[0], hole)) return null;
          }
        }
        exclusions.push(exterior.points);
      }
    }
  } catch {
    return null;
  }
  return exclusions;
}

/** Screens a shelter/origin point against the same exclusions used for routes. */
export function pointAvoidsPolygons(point: [number, number], polygons: unknown[]): boolean {
  if (!position(point)) return false;
  const exclusions = normalizePolygonExclusions(polygons);
  if (exclusions === null) return false;
  return exclusions.every(points => !insideOrBoundary(point, { points, bounds: bounds(points) }));
}

/** True only when a usable route avoids every supplied exclusion, including boundary contact. */
export function routeAvoidsPolygons(coordinates: [number, number][], polygons: unknown[]): boolean {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > MAX_ROUTE_POINTS || !coordinates.every(position)) return false;
  if (coordinates.every((point) => samePoint(point, coordinates[0]))) return false;
  for (let i = 1; i < coordinates.length; i++) {
    if (Math.abs(coordinates[i][0] - coordinates[i - 1][0]) > 180) return false;
  }
  const exclusions = normalizePolygonExclusions(polygons);
  if (exclusions === null) return false;
  const routeBounds = bounds(coordinates);
  for (const points of exclusions) {
    const ring = { points, bounds: bounds(points) };
    if (!boxesOverlap(routeBounds, ring.bounds)) continue;
    if (coordinates.some((point) => insideOrBoundary(point, ring))) return false;
    for (let i = 1; i < coordinates.length; i++) {
      const a = coordinates[i - 1];
      const b = coordinates[i];
      if (!boxesOverlap(bounds([a, b]), ring.bounds)) continue;
      for (let j = 1; j < points.length; j++) {
        if (segmentsIntersect(a, b, points[j - 1], points[j])) return false;
      }
    }
  }
  return true;
}
