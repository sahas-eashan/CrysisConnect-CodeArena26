import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];

export function assertDbEnv() {
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export function createClient() {
  assertDbEnv();

  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

export async function executeSqlFile(filePath) {
  const sql = await readFile(filePath, "utf8");
  const client = createClient();

  try {
    await client.connect();
    await client.query(sql);
    console.log(`Executed SQL file successfully: ${filePath}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("run-sql.mjs")) {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: node scripts/run-sql.mjs <sql-file>");
    process.exit(1);
  }

  executeSqlFile(filePath).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
