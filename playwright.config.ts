import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { HAZARD_DEMO_MODE: "true", HAZARD_STORE_PATH: `.data/e2e-${Date.now()}.json`, DATABASE_URL: "", GEMINI_API_KEY: "", GOOGLE_API_KEY: "", NEXT_PUBLIC_COGNITO_USER_POOL_ID: "", NEXT_PUBLIC_APPSYNC_GRAPHQL_URL: "", OSRM_BASE_URL: "http://127.0.0.1:1", HAZARD_GEOGRAPHY_JSON: "", HAZARD_GEOGRAPHY_FILE: "" }
  }
});
