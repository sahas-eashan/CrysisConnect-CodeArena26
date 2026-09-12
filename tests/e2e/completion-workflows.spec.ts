import { expect, test, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

const point = { latitude: 6.952, longitude: 79.88 };
const government = { "x-demo-role": "government" };
let photo: { name: string; mimeType: string; buffer: Buffer };
let reportPhoto: string;
test.use({ geolocation: point, permissions: ["geolocation"] });
test.beforeAll(async () => {
  photo = { name: "independent-observation.png", mimeType: "image/png", buffer: await sharp({ create: { width: 9, height: 9, channels: 3, background: "#235d93" } }).png().toBuffer() };
  reportPhoto = `data:image/png;base64,${(await sharp({ create: { width: 9, height: 9, channels: 3, background: "#953c2f" } }).png().toBuffer()).toString("base64")}`;
});

async function createCase(request: APIRequestContext, title: string, helpRequested = false) {
  const response = await request.post("/api/hazards", { headers: { "x-demo-role": "citizen" }, data: { action: "report", input: {
    title, description: "Browser test report with private resident details that must stay out of the public map.", kind: "blocked_road", location: point,
    photo: { dataUrl: reportPhoto }, helpRequested, needs: helpRequested ? "Two residents need shelter and drinking water." : ""
  } } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

test("nearby citizen receives an invitation, submits a photo, and can remove shared location", async ({ page, context, request }) => {
  const title = `Community hazard ${Date.now()}`;
  const reported = await createCase(request, title);
  await page.goto("/citizen/hazards");
  await page.getByLabel("Demo citizen").selectOption("neighbor");
  await page.getByRole("button", { name: "Share location for alerts and verification", exact: true }).click();
  await expect(page.getByText(/Using 6.95200, 79.88000 for nearby updates/)).toBeVisible();
  await expect.poll(async () => {
    const state = await (await request.get("/api/hazards", { headers: { "x-demo-role": "citizen", "x-demo-profile": "neighbor" } })).json();
    return state.resident?.alertsEnabled;
  }).toBe(true);
  const officer = await context.newPage();
  await officer.goto("/admin/hazards");
  const review = officer.getByRole("article", { name: title, exact: true });
  await expect(review.getByText(/Responsible council:/)).toBeVisible();
  await expect(review.getByText(/Urgency:/)).toBeVisible();
  await review.getByText("Assign responsible council", { exact: true }).click();
  await review.getByLabel("Responsible council").selectOption("DEMO-COUNCIL-A");
  await review.getByLabel("Council assignment reason").fill("Duty officer reassigned this test response to the neighboring council.");
  await review.getByRole("button", { name: "Save council assignment" }).click();
  await expect(review.getByText(/Responsible council: Demo Council A/)).toBeVisible();
  await officer.getByLabel("Filter by council").selectOption("DEMO-COUNCIL-B");
  await expect(review).toHaveCount(0);
  await officer.getByLabel("Filter by council").selectOption("all");
  await officer.getByLabel("Filter by ward").selectOption("DEMO-WARD-NORTH");
  await expect(review).toBeVisible();
  await review.getByLabel("Reviewer note").fill("Please confirm the road condition from a safe nearby location.");
  await review.getByRole("button", { name: "Ask nearby residents to verify" }).click();
  await expect(officer.getByRole("status").filter({ hasText: "Verification invitations sent" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const invitation = page.getByRole("article", { name: /Community request:/ }).filter({ hasText: "Please confirm the road condition" });
  await expect(invitation).toBeVisible();
  await invitation.getByLabel("Community verification photo (required)").setInputFiles(photo);
  await invitation.getByLabel("What can you observe?").fill("I can independently observe the blockage from this safe location.");
  await invitation.getByRole("button", { name: "Submit independent observation" }).click();
  await expect(invitation.getByText("Observation recorded: supports.")).toBeVisible();
  const state = await (await request.get("/api/hazards", { headers: government })).json();
  const saved = state.cases.find((item: { id: string }) => item.id === reported.id);
  expect(saved.evidence.some((item: { uploadedBy: string }) => item.uploadedBy === "demo-neighbor")).toBe(true);
  await page.getByRole("button", { name: "Stop sharing and remove location" }).click();
  await expect(page.getByText(/Stored location removed and nearby invitations disabled/)).toBeVisible();
  const forgotten = await (await request.get("/api/hazards", { headers: { "x-demo-role": "citizen", "x-demo-profile": "neighbor" } })).json();
  expect(forgotten.resident?.location).toBeUndefined();
});

test("officer can restrict a false reporter with a reason and restore reporting", async ({ page, request }) => {
  const title = `Moderated hazard ${Date.now()}`;
  const reported = await createCase(request, title);
  await page.goto("/admin/hazards");
  const review = page.getByRole("article", { name: title, exact: true });
  await review.getByLabel("Reviewer note").fill("Test evidence establishes this report was knowingly fabricated.");
  await review.getByLabel("Reviewer urgency").selectOption("low");
  await review.getByRole("button", { name: "Reject report", exact: true }).click();
  await expect(review.getByText("Urgency: Low", { exact: true })).toBeVisible();
  await review.getByText("Restrict false reporting", { exact: true }).click();
  await review.getByLabel("Reason for reporting restriction").fill("Repeated deliberate false reports were checked by the duty officer.");
  await review.getByRole("button", { name: "Restrict this reporter" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reporting restricted with a recorded reason" })).toBeVisible();
  const denied = await request.post("/api/hazards", { headers: { "x-demo-role": "citizen" }, data: { action: "evidence", input: { id: reported.id, photo: { dataUrl: `data:image/png;base64,${photo.buffer.toString("base64")}` }, notes: "This blocked reporter must not submit more evidence." } } });
  expect(denied.status()).toBe(403);
  await page.getByLabel("Reason to restore reporting").fill("Officer reviewed the restriction and approved restoring access.");
  await page.getByRole("button", { name: "Restore reporting access" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reporting restriction lifted" })).toBeVisible();
  const state = await (await request.get("/api/hazards", { headers: government })).json();
  expect(state.reporters.find((reporter: { id: string }) => reporter.id === "demo-citizen").banned).toBe(false);
});

test("dedicated relief coordinator reserves and releases shelter places", async ({ page, request }) => {
  const title = `Relief household ${Date.now()}`;
  const reported = await createCase(request, title, true);
  const approved = await request.post("/api/hazards", { headers: government, data: { action: "review", input: { id: reported.id, decision: "confirmed", notes: "Officer confirms affected residents require assistance." } } });
  expect(approved.ok(), await approved.text()).toBe(true);
  await page.goto("/relief/hazards");
  await expect(page.getByRole("heading", { name: "Relief requests and shelter coordination", exact: true })).toBeVisible();
  const allocation = page.getByRole("article", { name: title, exact: true });
  await allocation.getByText("Allocate relief and shelter", { exact: true }).click();
  await allocation.getByLabel("Relief organization").fill("Test relief desk");
  await allocation.getByLabel("Resources and delivery details").fill("Two places and drinking water delivered to the household.");
  await allocation.getByLabel("Shelter allocation").selectOption("demo-colombo-north");
  await allocation.getByLabel("People to accommodate").fill("2");
  await allocation.getByRole("button", { name: "Save relief allocation" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Relief assignment saved" })).toBeVisible();
  await allocation.getByText("Release shelter allocation", { exact: true }).click();
  await allocation.getByLabel("Departure confirmation").fill("Both residents have checked out and their places can be released.");
  await allocation.getByRole("button", { name: "Confirm departure and release places" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Shelter places released" })).toBeVisible();
  await allocation.getByLabel("Allocation method").selectOption("nearest");
  await allocation.getByLabel("People to accommodate").fill("2");
  await allocation.getByRole("button", { name: "Find and reserve nearest shelter" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Shelter allocation saved" })).toBeVisible();
  await expect(allocation.getByText("No screened route available", { exact: true })).toBeVisible();
  await expect(allocation.getByRole("status")).toContainText(/crew|rescue|assisted|evacuat/i);
  await allocation.getByText("Release shelter allocation", { exact: true }).click();
  await allocation.getByLabel("Departure confirmation").fill("The assisted evacuation test has ended and both places can be released.");
  await allocation.getByRole("button", { name: "Confirm departure and release places" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Shelter places released" })).toBeVisible();
  const forbidden = await request.post("/api/hazards", { headers: { "x-demo-role": "relief" }, data: { action: "review", input: { id: reported.id, decision: "rejected", notes: "Relief staff must not have officer review permissions." } } });
  expect(forbidden.status()).toBe(403);
});

test("public map is anonymous and its endpoint contains only public fields", async ({ page, request }) => {
  const privateCalls: string[] = [];
  page.on("request", (call) => { if (new URL(call.url()).pathname === "/api/hazards") privateCalls.push(call.url()); });
  await page.goto("/public-map");
  await expect(page.getByRole("heading", { name: "Public hazard map", exact: true })).toBeVisible();
  await expect(page.getByText("No account is needed to view this map.", { exact: false })).toBeVisible();
  await expect(page.locator(".maplibregl-map")).toBeVisible();
  expect(privateCalls).toEqual([]);
  const response = await request.get("/api/hazards/public");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["alerts", "fixtureShelters", "generatedAt", "hazards", "shelters"].sort());
  expect(JSON.stringify(body)).not.toContain("private resident details");
  expect(JSON.stringify(body)).not.toContain("data:image/");
  expect(JSON.stringify(body)).not.toContain("demo-citizen");
});

test("area warning supplies route guidance automatically and hides it on refresh failure", async ({ page, request }) => {
  const weather = await request.post("/api/hazards", { headers: government, data: { action: "weather", input: { stationId: `E2E-AUTO-${Date.now()}`, location: point, rainfallMm: 95, waterLevelM: 5.4, dangerLevelM: 4, observedAt: new Date().toISOString() } } });
  expect(weather.ok()).toBe(true);
  const warning = await weather.json();
  let routeRequests = 0;
  page.on("request", (call) => { if (call.method() === "POST" && call.url().endsWith("/api/hazards") && call.postDataJSON()?.action === "route") routeRequests++; });
  await page.goto("/citizen/hazards");
  await page.getByRole("button", { name: "Share location for alerts and verification", exact: true }).click();
  await expect(page.getByText("Included automatically with this area warning.").first()).toBeVisible();
  await expect(page.getByText("No screened route available", { exact: true }).first()).toBeVisible();
  expect(routeRequests).toBe(0);
  await page.route("**/api/hazards?*", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test refresh outage" }) }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Route guidance is paused until the latest hazard information can be loaded.")).toBeVisible();
  await expect(page.getByText("Included automatically with this area warning.")).toHaveCount(0);
  const cleared = await request.post("/api/hazards", { headers: government, data: { action: "review", input: { id: warning.case.id, decision: "rejected", notes: "This simulated weather warning test has ended; remove its area exclusion." } } });
  expect(cleared.ok()).toBe(true);
});
