import assert from "node:assert/strict";
import test from "node:test";
import { normalizePolygonExclusions, pointAvoidsPolygons, routeAvoidsPolygons } from "../src/lib/hazards/polygon-safety";

type Position = [number, number];
const square: Position[] = [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]];
const polygon = (exterior: Position[], holes: Position[][] = []) => ({ type: "Polygon", coordinates: [exterior, ...holes] });
const outside: Position[] = [[0, 0], [3, 0]];

test("screens full route segments, including crossings with both endpoints outside", () => {
  assert.equal(routeAvoidsPolygons([[0, 1.5], [3, 1.5]], [polygon(square)]), false);
  assert.equal(routeAvoidsPolygons([[0, 1.5], [0, 0], [3, 0], [3, 1.5]], [polygon(square)]), true);
  assert.equal(routeAvoidsPolygons(outside, [JSON.stringify(polygon(square))]), true);
});

test("rejects boundary touches, vertex tangency, travel along an edge, and interior routes", () => {
  for (const route of [
    [[0, 1], [3, 1]],
    [[0, 0], [1, 1]],
    [[0, 2], [2, 0]],
    [[1.2, 1.2], [1.8, 1.8]],
    [[1.5, 1.5], [3, 1.5]],
  ] satisfies Position[][]) assert.equal(routeAvoidsPolygons(route, [polygon(square)]), false);
});

test("tests every MultiPolygon member and every supplied geometry", () => {
  const distant: Position[] = [[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]];
  const route: Position[] = [[0, 1.5], [3, 1.5]];
  assert.equal(routeAvoidsPolygons(route, [{ type: "MultiPolygon", coordinates: [[distant], [square]] }]), false);
  assert.equal(routeAvoidsPolygons(route, [polygon(distant), polygon(square)]), false);
  assert.equal(routeAvoidsPolygons(outside, [{ type: "MultiPolygon", coordinates: [[distant], [square]] }]), true);
});

test("keeps holes conservatively excluded and rejects invalid holes", () => {
  const exterior: Position[] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const hole: Position[] = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
  const geometry = polygon(exterior, [hole]);
  assert.notEqual(normalizePolygonExclusions([geometry]), null);
  assert.equal(routeAvoidsPolygons([[4, 4], [6, 6]], [geometry]), false);
  assert.equal(routeAvoidsPolygons([[-2, -2], [-1, -1]], [geometry]), true);
  assert.equal(normalizePolygonExclusions([polygon(square, [hole])]), null);
  assert.equal(normalizePolygonExclusions([polygon(exterior, [hole, hole])]), null);
});

test("handles concave polygons and either ring orientation", () => {
  const concave: Position[] = [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3], [0, 0]];
  for (const ring of [concave, [...concave].reverse()]) {
    assert.equal(routeAvoidsPolygons([[1.5, 1.5], [2.5, 2.5]], [polygon(ring)]), true);
    assert.equal(routeAvoidsPolygons([[-1, 2], [2, 2]], [polygon(ring)]), false);
  }
});

test("rejects unavailable, malformed, out-of-range and unsupported geometries", () => {
  const invalid: unknown[] = [
    null, undefined, "", "not-json", {}, [],
    { type: "Point", coordinates: [1, 1] },
    { type: "Polygon", coordinates: [] },
    { type: "MultiPolygon", coordinates: [] },
    { type: "Polygon", coordinates: [[[181, 1], [2, 1], [2, 2], [181, 1]]] },
    { type: "Polygon", coordinates: [[[1, "1"], [2, 1], [2, 2], [1, "1"]]] },
  ];
  for (const geometry of invalid) {
    assert.equal(normalizePolygonExclusions([geometry]), null);
    assert.equal(routeAvoidsPolygons(outside, [polygon(square), geometry]), false);
  }
});

test("rejects open, collapsed, repeated-vertex and self-intersecting rings", () => {
  const invalid: Position[][] = [
    [[1, 1], [2, 1], [2, 2], [1, 2]],
    [[1, 1], [1, 1], [1, 1], [1, 1]],
    [[1, 1], [2, 2], [3, 3], [1, 1]],
    [[0, 0], [4, 0], [1, 4], [4, 4], [0, 0]],
    [[0, 0], [3, 0], [3, 3], [3, 0], [0, 3], [0, 0]],
  ];
  for (const ring of invalid) assert.equal(routeAvoidsPolygons(outside, [polygon(ring)]), false);
});

test("rejects unusable routes and unsupported antimeridian segments", () => {
  for (const route of [[], [[0, 0]], [[0, 0], [0, 0]], [[NaN, 0], [1, 1]], [[0, Infinity], [1, 1]], [[181, 0], [1, 1]], [[0, 91], [1, 1]], [[-179, 0], [179, 0]]] satisfies Position[][]) {
    assert.equal(routeAvoidsPolygons(route, []), false);
  }
  assert.equal(routeAvoidsPolygons(outside, []), true);
  assert.equal(routeAvoidsPolygons(outside, [polygon([[-179, 0], [179, 0], [179, 1], [-179, 1], [-179, 0]])]), false);
});

test("normalization copies caller coordinates instead of mutating them", () => {
  const original = polygon(square);
  const result = normalizePolygonExclusions([original]);
  assert.ok(result);
  result[0][0][0] = 80;
  assert.equal(original.coordinates[0][0][0], 1);
});

test("shelter points must be outside every polygon and boundary", () => {
  assert.equal(pointAvoidsPolygons([0, 0], [polygon(square)]), true);
  for (const point of [[1.5, 1.5], [1, 1], [1, 1.5]] satisfies Position[]) {
    assert.equal(pointAvoidsPolygons(point, [polygon(square)]), false);
  }
  assert.equal(pointAvoidsPolygons([0, 0], [null]), false);
  assert.equal(pointAvoidsPolygons([NaN, 0], []), false);
  assert.equal(pointAvoidsPolygons([0, 0], []), true);
  const exterior: Position[] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const hole: Position[] = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
  assert.equal(pointAvoidsPolygons([5, 5], [polygon(exterior, [hole])]), false);
});
