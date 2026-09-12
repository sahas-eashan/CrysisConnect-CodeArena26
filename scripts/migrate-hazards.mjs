import { readFile } from "node:fs/promises";
import pg from "pg";

try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before applying the hazard migration.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query(await readFile(new URL("../db/migrations/002_hazards.sql", import.meta.url), "utf8"));
  console.log("Hazard state migration applied. Existing application records were retained.");
} finally { await client.end(); }
