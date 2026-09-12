import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import demo from "../src/lib/hazards/geography.demo.json";
import { geographyCatalog, resolveGeography } from "../src/lib/hazards/geography";

const point = { latitude: 6.952, longitude: 79.88 };
const live = () => ({ ...structuredClone(demo), source: "TEST operator verified administrative fixture", fixture: false, verified: true });

test("demo coordinates map to explicitly fictional wards and councils with the nearest full road segment", () => {
  const mapped = resolveGeography(point, { config: demo, demo: true });
  assert.equal(mapped.status, "mapped");
  assert.equal(mapped.fixture, true);
  assert.equal(mapped.ward?.id, "DEMO-WARD-NORTH");
  assert.equal(mapped.council?.id, "DEMO-COUNCIL-B");
  assert.deepEqual(mapped.road, { id: "DEMO-ROAD-01", name: "Demo East-West Road", distanceM: 0 });
  const west = resolveGeography({ latitude: 6.955, longitude: 79.8701 }, { config: demo, demo: true });
  assert.equal(west.ward?.id, "DEMO-WARD-WEST");
  assert.equal(west.council?.id, "DEMO-COUNCIL-A");
  assert.equal(west.road?.id, "DEMO-ROAD-02");
  assert.ok(west.road!.distanceM > 10 && west.road!.distanceM < 12, "Nearest segment distance works between road vertices.");
});

test("shared ward boundaries remain ambiguous and never select an arbitrary council", () => {
  const boundary = resolveGeography({ latitude: 6.952, longitude: 79.875 }, { config: demo, demo: true });
  assert.equal(boundary.status, "ambiguous");
  assert.equal(boundary.council, undefined);
  assert.equal(boundary.ward, undefined);
  assert.match(boundary.reason, /shared ward boundary/);
});

test("outside coverage and a ward without a nearby road do not invent geographic assignments", () => {
  const outside = resolveGeography({ latitude: 7.1, longitude: 80.1 }, { config: live() });
  assert.equal(outside.status, "outside_coverage");
  assert.equal(outside.council, undefined);
  const farFromRoad = resolveGeography({ latitude: 6.935, longitude: 79.9 }, { config: live() });
  assert.equal(farFromRoad.status, "mapped");
  assert.equal(farFromRoad.road, undefined);
  assert.match(farFromRoad.reason, /No configured road/);
});

test("live mapping rejects fictional, unverified and malformed boundary data", () => {
  assert.equal(resolveGeography(point, { config: demo }).status, "unconfigured");
  assert.equal(resolveGeography(point, { config: { ...live(), verified: false } }).status, "unconfigured");
  const malformed = live();
  malformed.features[0].geometry.coordinates = [[[79.84, 6.92], [79.875, 6.92], [79.875, 6.98]]];
  assert.equal(resolveGeography(point, { config: malformed }).status, "unconfigured");
  assert.equal(resolveGeography({ latitude: NaN, longitude: 79.88 }, { config: live() }).status, "unconfigured");
});

test("GeoJSON multipolygons respect excluded holes and the catalog deduplicates council IDs", () => {
  const config = {
    type: "FeatureCollection", source: "TEST boundaries with excluded lake", fixture: false, verified: true,
    features: [{ type: "Feature", properties: { kind: "ward", id: "ward-a", name: "TEST ward", councilId: "council-a", councilName: "TEST council" },
      geometry: { type: "MultiPolygon", coordinates: [[[[79, 6], [80, 6], [80, 7], [79, 7], [79, 6]], [[79.4, 6.4], [79.6, 6.4], [79.6, 6.6], [79.4, 6.6], [79.4, 6.4]]], [[[81, 6], [82, 6], [82, 7], [81, 7], [81, 6]]]] } }],
  };
  assert.equal(resolveGeography({ latitude: 6.5, longitude: 79.5 }, { config }).status, "outside_coverage");
  assert.equal(resolveGeography({ latitude: 6.2, longitude: 79.5 }, { config }).ward?.id, "ward-a");
  assert.equal(resolveGeography({ latitude: 6.5, longitude: 81.5 }, { config }).ward?.id, "ward-a");
  const catalog = geographyCatalog({ config: demo, demo: true });
  assert.equal(catalog.wards.length, 3);
  assert.deepEqual(catalog.councils.map(council => council.id), ["DEMO-COUNCIL-A", "DEMO-COUNCIL-B"]);
  assert.deepEqual(geographyCatalog({ config: demo }), { councils: [], wards: [] });
});

test("duplicate ward IDs, inconsistent council names and antimeridian geometry are rejected", () => {
  const duplicate = live();
  duplicate.features.push(structuredClone(duplicate.features[0]));
  assert.equal(resolveGeography(point, { config: duplicate }).status, "unconfigured");
  const inconsistent = live();
  inconsistent.features[1].properties.councilName = "Conflicting name";
  assert.equal(resolveGeography(point, { config: inconsistent }).status, "unconfigured");
  const crossing = live();
  crossing.features[3].geometry.coordinates = [[179, 6.9], [-179, 6.9]];
  assert.equal(resolveGeography(point, { config: crossing }).status, "unconfigured");
});

test("server configuration reads verified GeoJSON from JSON or a file and never silently falls back on demo after an error", async () => {
  const previousJSON = process.env.HAZARD_GEOGRAPHY_JSON;
  const previousFile = process.env.HAZARD_GEOGRAPHY_FILE;
  const directory = await mkdtemp(join(tmpdir(), "hazard-geography-test-"));
  try {
    delete process.env.HAZARD_GEOGRAPHY_JSON;
    delete process.env.HAZARD_GEOGRAPHY_FILE;
    assert.equal(resolveGeography(point).status, "unconfigured");
    assert.equal(resolveGeography(point, { demo: true }).fixture, true);
    process.env.HAZARD_GEOGRAPHY_JSON = JSON.stringify(live());
    assert.equal(resolveGeography(point).fixture, false);
    assert.equal(resolveGeography(point).status, "mapped");
    process.env.HAZARD_GEOGRAPHY_JSON = "invalid-json";
    assert.equal(resolveGeography(point, { demo: true }).status, "unconfigured");
    delete process.env.HAZARD_GEOGRAPHY_JSON;
    const file = join(directory, "boundaries.json");
    await writeFile(file, JSON.stringify(live()), "utf8");
    process.env.HAZARD_GEOGRAPHY_FILE = file;
    assert.equal(resolveGeography(point).status, "mapped");
    assert.equal(geographyCatalog().wards.length, 3);
    process.env.HAZARD_GEOGRAPHY_FILE = join(directory, "missing.json");
    assert.equal(resolveGeography(point, { demo: true }).status, "unconfigured");
  } finally {
    if (previousJSON === undefined) delete process.env.HAZARD_GEOGRAPHY_JSON; else process.env.HAZARD_GEOGRAPHY_JSON = previousJSON;
    if (previousFile === undefined) delete process.env.HAZARD_GEOGRAPHY_FILE; else process.env.HAZARD_GEOGRAPHY_FILE = previousFile;
    // mkdtemp created this exact directory under the OS temp root; remove only the known test file and empty directory.
    await rm(join(directory, "boundaries.json"), { force: true });
    const { rmdir } = await import("node:fs/promises");
    await rmdir(directory);
  }
});
