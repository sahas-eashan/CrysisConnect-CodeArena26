import { expect, test } from "@playwright/test";
import sharp from "sharp";

// A tiny generated PNG is test evidence only. No fake image diagnosis is injected.
let photo: { name: string; mimeType: string; buffer: Buffer };
test.beforeAll(async () => {
  photo = { name: "test-evidence.png", mimeType: "image/png", buffer: await sharp({ create: { width: 8, height: 8, channels: 3, background: "#bd3030" } }).png().toBuffer() };
});
const point = { latitude: 6.952, longitude: 79.88 };
test.use({ geolocation: point, permissions: ["geolocation"] });

test("citizen photo report, officer verification, relief, crew clearance and citizen update", async ({ page, context }, testInfo) => {
  const title = `Road hazard ${Date.now()}`;
  await page.goto("/citizen/hazards");
  await expect(page.getByText(/^Local demonstration · Citizen reporter/)).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Ward or locality").fill("Colombo test ward");
  await page.getByLabel("What is happening?").fill("Water has blocked this road. This report is automated test evidence.");
  await page.getByRole("button", { name: "Capture my location" }).click();
  await page.getByLabel("Photo evidence (required)").setInputFiles(photo);
  await page.getByLabel("I need help or relief supplies").check();
  await page.getByLabel("People affected and assistance needed").fill("Four people need shelter and drinking water.");
  await page.getByRole("button", { name: "Submit hazard report" }).click();
  const citizenCase = page.getByRole("article", { name: title, exact: true });
  await expect(citizenCase).toBeVisible();
  await expect(citizenCase.getByText("Confidence unavailable", { exact: true })).toBeVisible();
  await citizenCase.getByText("Verification checks and evidence (5)", { exact: true }).click();
  await expect(citizenCase.getByText(/Gemini is not configured/).first()).toBeVisible();
  await expect(page.getByText("Loading street map…", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("citizen-hazard-desktop.png"), fullPage: true });

  const officer = await context.newPage();
  await officer.goto("/admin/hazards");
  const officerCase = officer.getByRole("article", { name: title, exact: true });
  await officerCase.getByLabel("Reviewer note").fill("Please provide a second photograph of the affected road.");
  await officerCase.getByRole("button", { name: "Request more information" }).click();
  await expect(officer.getByRole("status").filter({ hasText: "Request for more evidence" })).toBeVisible();

  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await citizenCase.getByText("Provide more evidence", { exact: true }).click();
  await citizenCase.getByLabel("Additional photo (required)").setInputFiles(photo);
  await citizenCase.getByLabel("What does this photo show?").fill("Additional test photograph for the officer to review.");
  await citizenCase.getByRole("button", { name: "Submit additional evidence" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Additional evidence saved" })).toBeVisible();

  await officer.getByRole("button", { name: "Refresh", exact: true }).click();
  await officerCase.getByLabel("Reviewer note").fill("Field observer confirms this test road closure; proceed with dispatch.");
  await officerCase.getByRole("button", { name: "Confirm hazard", exact: true }).click();
  await expect(officerCase.getByText("Confirmed", { exact: true })).toBeVisible();
  await officerCase.getByText("Allocate relief and shelter", { exact: true }).click();
  await officerCase.getByLabel("Relief organization").fill("Test relief team");
  await officerCase.getByLabel("Resources and delivery details").fill("Drinking water and four shelter places for this test.");
  await officerCase.getByLabel("Shelter allocation").selectOption("demo-colombo-north");
  await officerCase.getByLabel("People to accommodate").fill("4");
  await officerCase.getByRole("button", { name: "Save relief allocation" }).click();
  await expect(officer.getByRole("status").filter({ hasText: "Relief assignment saved" })).toBeVisible();
  await officerCase.getByText("Dispatch a response crew", { exact: true }).click();
  await officerCase.getByRole("button", { name: "Assign crew", exact: true }).click();
  await expect(officerCase.getByText("Assigned", { exact: true })).toBeVisible();

  const crew = await context.newPage();
  await crew.goto("/ngo/hazards");
  const crewCase = crew.getByRole("article", { name: title, exact: true });
  await crewCase.getByText("Close hazard with field evidence", { exact: true }).click();
  const clearanceImage = await crew.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 8;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#16803c"; context.fillRect(0, 0, 8, 8);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await crewCase.getByLabel("Clearance photo (required)").setInputFiles({ name: "clearance-evidence.png", mimeType: "image/png", buffer: Buffer.from(clearanceImage, "base64") });
  await crewCase.getByLabel("What was cleared and checked?").fill("Test crew cleared the obstruction and checked access.");
  await crewCase.getByRole("button", { name: "Confirm clearance and close" }).click();
  await expect(crewCase.getByText("Resolved", { exact: true })).toBeVisible();
  // The citizen screen remains open: verify the polling update, without navigating or refreshing.
  await expect(citizenCase.getByText("Resolved", { exact: true })).toBeVisible({ timeout: 20_000 });
  const snapshot = await (await page.request.get(`/api/hazards?lat=${point.latitude}&lon=${point.longitude}`, { headers: { "x-demo-role": "government" } })).json();
  const saved = snapshot.cases.find((item: { title: string }) => item.title === title);
  expect(saved.status).toBe("resolved");
  expect(snapshot.hazards.some((item: { id: string }) => item.id === saved.id)).toBe(false);
  expect(saved.evidence.some((item: { kind: string }) => item.kind === "closure")).toBe(true);
  expect(snapshot.alerts.some((item: { kind: string; caseId: string }) => item.kind === "hazard_resolved" && item.caseId === saved.id)).toBe(true);
});

test("weather creates a warning without a citizen complaint and enforces actor roles", async ({ request }) => {
  const before = await (await request.get("/api/hazards", { headers: { "x-demo-role": "government" } })).json();
  const denied = await request.post("/api/hazards", { headers: { "x-demo-role": "citizen" }, data: { action: "replay", input: { scenario: "flood" } } });
  expect(denied.status()).toBe(403);
  const replay = await request.post("/api/hazards", { headers: { "x-demo-role": "government" }, data: { action: "replay", input: { scenario: "flood" } } });
  expect(replay.ok()).toBe(true);
  const result = await replay.json();
  expect(result.case.source).toBe("weather");
  expect(result.case.status).toBe("needs_verification");
  const after = await (await request.get(`/api/hazards?lat=${point.latitude}&lon=${point.longitude}`)).json();
  expect(after.alerts.some((alert: { kind: string; caseId: string }) => alert.kind === "weather_warning" && alert.caseId === result.case.id)).toBe(true);
  const otherArea = await (await request.get("/api/hazards?lat=8&lon=81")).json();
  expect(otherArea.alerts.some((alert: { caseId: string }) => alert.caseId === result.case.id)).toBe(false);
  expect(before.cases.some((item: { id: string }) => item.id === result.case.id)).toBe(false);
  const crossOrigin = await request.post("/api/hazards", { headers: { origin: "https://other.example", "x-demo-role": "government" }, data: { action: "replay", input: { scenario: "flood" } } });
  expect(crossOrigin.status()).toBe(403);
});

test("citizen workflow fits a phone viewport and exposes usable navigation", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/citizen/hazards");
  await expect(page.getByLabel("Photo evidence (required)")).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Citizen.*navigation/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const map = page.locator(".maplibregl-map");
  await expect(map).toBeVisible();
  await expect.poll(() => map.evaluate((element) => {
    const canvas = element.querySelector("canvas");
    return Boolean(canvas && Math.abs(canvas.clientWidth - element.clientWidth) < 2 && Math.abs(canvas.clientHeight - element.clientHeight) < 2);
  })).toBe(true);
  await expect(page.getByText("Loading street map…", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.workers().some((worker) => worker.url().includes("/maplibre/maplibre-gl-worker.mjs"))).toBe(true);
  await expect(page.getByText("Some map layers could not load.", { exact: false })).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("citizen-hazard-mobile.png"), fullPage: true });
  await map.screenshot({ path: testInfo.outputPath("hazard-map-mobile.png") });
});

test("failed photo submission preserves the report and does not claim success", async ({ page }) => {
  const title = `Unsent hazard ${Date.now()}`;
  await page.goto("/citizen/hazards");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Ward or locality").fill("Test ward");
  await page.getByLabel("What is happening?").fill("Test report to verify a failed submission stays available for retry.");
  await page.getByRole("button", { name: "Capture my location" }).click();
  await page.getByLabel("Photo evidence (required)").setInputFiles(photo);
  await page.route("**/api/hazards", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.postDataJSON()?.action === "report") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test server cannot save this report. Please retry." }) });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Submit hazard report" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Test server cannot save" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
  await expect(page.getByRole("article", { name: title, exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Report saved" })).toHaveCount(0);
});

test("map reports a missing selected shelter without silently selecting another", async ({ page }) => {
  await page.goto("/citizen/map?safeZone=missing-shelter");
  await expect(page.getByText("The requested shelter is unavailable or no longer listed.", { exact: false })).toBeVisible();
  await expect(page.getByText("Selected shelter:", { exact: false })).toHaveCount(0);
  await expect(page.getByText("AWS disaster and resource services are not configured.", { exact: false })).toBeVisible();
});

test("new weather evidence invalidates a displayed route before hazard confirmation", async ({ page }) => {
  // This controlled response isolates UI invalidation from the external routing
  // provider. The service's geographic screening has separate domain coverage.
  await page.route("**/api/hazards", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.postDataJSON()?.action === "route") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        status: "available", reason: "Controlled route response for the invalidation test.",
        coordinates: [[79.88, 6.952], [79.881, 6.953]], screenedHazardIds: [],
        checkedAt: new Date().toISOString(), limitations: []
      }) });
    } else await route.continue();
  });
  await page.goto("/citizen/hazards");
  await page.getByRole("button", { name: "Use my location", exact: true }).click();
  await page.getByRole("button", { name: "Check route to a shelter", exact: true }).click();
  const shownRoute = page.getByText("Route screened against known hazards", { exact: true });
  await expect(shownRoute).toBeVisible();

  const weather = await page.request.post("/api/hazards", { headers: { "x-demo-role": "government" }, data: { action: "replay", input: { scenario: "flood" } } });
  expect(weather.ok()).toBe(true);
  const reading = await weather.json();
  expect(reading.case.status).toBe("needs_verification");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(shownRoute).toHaveCount(0);
});
