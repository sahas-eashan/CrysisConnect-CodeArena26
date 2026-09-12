import { setTimeout as sleep } from "node:timers/promises";

import { createClient, executeSqlFile } from "./run-sql.mjs";

const schemaFile = "db/migrations/001_schema.sql";
const seedFile = "db/seed.sql";
const maxAttempts = Number(process.env.DB_BOOTSTRAP_MAX_ATTEMPTS ?? 24);
const waitMs = Number(process.env.DB_BOOTSTRAP_WAIT_MS ?? 10000);

async function waitForDatabase() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = createClient();

    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      console.log(`Database is ready on attempt ${attempt}.`);
      return;
    } catch (error) {
      await client.end().catch(() => undefined);

      if (attempt === maxAttempts) {
        throw new Error(
          `Database was not reachable after ${maxAttempts} attempts: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      console.log(`Database not ready yet (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
    }
  }
}

await waitForDatabase();
await executeSqlFile(schemaFile);
await executeSqlFile(seedFile);

console.log("Database bootstrap completed successfully.");
