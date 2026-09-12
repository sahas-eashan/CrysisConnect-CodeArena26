import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import test from "node:test";

const execute = promisify(execFile);
const script = resolve("scripts/verify-live-services.mjs");
const configurationNames = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "DATABASE_URL", "NEXT_PUBLIC_AWS_REGION", "NEXT_PUBLIC_COGNITO_USER_POOL_ID", "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID", "OSRM_BASE_URL", "NEXT_PUBLIC_APPSYNC_GRAPHQL_URL", "LIVE_CHECK_ID_TOKEN", "HAZARD_GEOGRAPHY_JSON", "HAZARD_GEOGRAPHY_FILE"];

async function fixture(run: (directory: string, environment: NodeJS.ProcessEnv) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "hazard-live-probe-"));
  const environment = { ...process.env };
  for (const name of configurationNames) environment[name] = "";
  try { await run(directory, environment); }
  finally {
    const absolute = resolve(directory);
    assert.equal(dirname(absolute), resolve(tmpdir()));
    assert.ok(basename(absolute).startsWith("hazard-live-probe-"));
    await rm(absolute, { recursive: true, force: true });
  }
}

test("configuration inventory never contacts providers or prints configured secret values", async () => {
  await fixture(async (directory, environment) => {
    const sentinel = "TEST_SECRET_MUST_NEVER_BE_PRINTED";
    for (const name of configurationNames) environment[name] = sentinel;
    const guard = join(directory, "block-network.mjs");
    await writeFile(guard, "globalThis.fetch = () => { throw new Error('Network is forbidden in configuration-only mode'); };\n");
    const result = await execute(process.execPath, ["--import", pathToFileURL(guard).href, script], { cwd: directory, env: environment });
    assert.equal(result.stdout.includes(sentinel), false);
    assert.equal(result.stderr.includes(sentinel), false);
    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, "configuration_only");
    assert.equal(report.status, "not_validated");
    assert.equal(report.checks.length, 7);
    assert.ok(report.checks.every((check: { status: string }) => check.status === "configured_not_tested"));
  });
});

test("the geography probe distinguishes invalid or fictional configuration from a usable non-fixture dataset without network calls", async () => {
  const configuration = {
    type: "FeatureCollection", source: "TEST_PRIVATE_GEOGRAPHY_SOURCE", verified: true, fixture: false,
    features: [{ type: "Feature", properties: { kind: "ward", id: "TEST-WARD", name: "Test ward", councilId: "TEST-COUNCIL", councilName: "Test council" }, geometry: { type: "Polygon", coordinates: [[[79.8, 6.9], [79.9, 6.9], [79.9, 7], [79.8, 7], [79.8, 6.9]]] } }],
  };
  const tsx = pathToFileURL(createRequire(resolve("package.json")).resolve("tsx")).href;
  for (const [value, expected] of [["invalid-json", "failed"], [JSON.stringify({ ...configuration, fixture: true }), "failed"], [JSON.stringify(configuration), "passed"]]) {
    await fixture(async (directory, environment) => {
      environment.HAZARD_GEOGRAPHY_JSON = value;
      const guard = join(directory, "block-network.mjs");
      await writeFile(guard, "globalThis.fetch = () => { throw new Error('No network is permitted for geography validation'); };\n");
      await assert.rejects(execute(process.execPath, ["--import", tsx, "--import", pathToFileURL(guard).href, script, "--live"], { cwd: directory, env: environment }), (error: unknown) => {
        const result = error as Error & { code: number; stdout: string; stderr: string };
        assert.equal(result.code, 2, "Unconfigured cloud adapters keep the overall run incomplete.");
        const report = JSON.parse(result.stdout);
        const geography = report.checks.find((check: { service: string }) => check.service === "Verified geography");
        assert.equal(geography.status, expected);
        if (expected === "passed") assert.match(geography.detail, /1 ward\(s\) and 1 council\(s\)/);
        assert.equal(report.checks.filter((check: { service: string }) => check.service !== "Verified geography").every((check: { status: string }) => check.status === "blocked"), true);
        assert.equal(result.stdout.includes(configuration.source), false);
        assert.equal(result.stderr, "");
        return true;
      });
    });
  }
});

test("live validation with missing credentials exits incomplete instead of reporting successful deployment", async () => {
  await fixture(async (directory, environment) => {
    await assert.rejects(execute(process.execPath, [script, "--live"], { cwd: directory, env: environment }), (error: unknown) => {
      const result = error as Error & { code: number; stdout: string; stderr: string };
      assert.equal(result.code, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, "live_read_only");
      assert.equal(report.status, "incomplete");
      assert.ok(report.checks.every((check: { status: string; missing: string[] }) => check.status === "blocked" && check.missing.length));
      assert.equal(result.stderr, "");
      return true;
    });
  });
});
