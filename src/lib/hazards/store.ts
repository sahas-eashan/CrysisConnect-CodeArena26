import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Pool } from "pg";
import { z } from "zod";
import type { HazardState, Shelter } from "./types";
import { HazardError, parse, pointSchema } from "./validation";

export interface HazardStore {
  readonly mode: "local-demo" | "postgres";
  read(): Promise<HazardState>;
  /** The callback is synchronous: network calls must run outside the transaction. */
  transaction<T>(operation: (state: HazardState) => T): Promise<T>;
  legacyHazards(): Promise<{ id: string; geometry: unknown }[]>;
}

export const DEMO_SHELTERS: Shelter[] = [
  { id: "demo-colombo-north", name: "DEMO — Colombo North Relief Centre", location: { latitude: 6.965, longitude: 79.872 }, capacity: 200, available: 160, fixture: true },
  { id: "demo-colombo-east", name: "DEMO — Colombo East Relief Centre", location: { latitude: 6.925, longitude: 79.898 }, capacity: 120, available: 90, fixture: true },
  { id: "demo-colombo-south", name: "DEMO — Colombo South Relief Centre", location: { latitude: 6.887, longitude: 79.868 }, capacity: 150, available: 110, fixture: true },
];

const shelterSchema = z.object({
  id: z.string().min(1).max(200), name: z.string().min(1).max(200), location: pointSchema,
  capacity: z.number().int().nonnegative(), available: z.number().int().nonnegative(), fixture: z.boolean().default(false),
}).refine(shelter => shelter.available <= shelter.capacity, "Shelter availability exceeds capacity.");

export function initialState(shelters: Shelter[] = []): HazardState {
  return {
    version: 1, cases: [], alerts: [], weather: [], feedback: [],
    thresholds: { rainMm: 50, clusterCount: 3, autoConfirmConfidence: 0.9, feedbackCount: 0 },
    shelters: structuredClone(shelters),
  };
}

function validateState(value: unknown): HazardState {
  const state = value as Partial<HazardState> | null;
  if (!state || state.version !== 1 || !Array.isArray(state.cases) || !Array.isArray(state.alerts) || !Array.isArray(state.weather) || !Array.isArray(state.feedback) || !Array.isArray(state.shelters) || !state.thresholds) {
    throw new HazardError("Hazard storage is invalid or has an unsupported version. Restore a valid backup; existing data has not been replaced.", 503, "STORAGE_INVALID");
  }
  return state as HazardState;
}

// One queue per resolved file, also shared across Next.js module reloads. Local mode is for one process only.
const globals = globalThis as typeof globalThis & { __hazardFileQueues?: Map<string, Promise<void>>; __hazardPgPool?: Pool };
const queues = globals.__hazardFileQueues ??= new Map<string, Promise<void>>();

export class LocalHazardStore implements HazardStore {
  readonly mode = "local-demo" as const;
  readonly file: string;
  constructor(file: string, private readonly seed: HazardState = initialState(DEMO_SHELTERS)) { this.file = resolve(file); }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const previous = queues.get(this.file) ?? Promise.resolve();
    const task = previous.then(operation, operation);
    const tail = task.then(() => undefined, () => undefined);
    queues.set(this.file, tail);
    try { return await task; } finally { if (queues.get(this.file) === tail) queues.delete(this.file); }
  }

  private async load(): Promise<HazardState> {
    try { return validateState(JSON.parse(await readFile(this.file, "utf8"))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(this.seed);
      if (error instanceof SyntaxError) throw new HazardError("Hazard storage cannot be parsed. Existing data has not been replaced.", 503, "STORAGE_INVALID");
      throw error;
    }
  }

  read(): Promise<HazardState> { return this.serialize(() => this.load()); }

  async legacyHazards(): Promise<{ id: string; geometry: unknown }[]> {
    if (process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL) throw new HazardError("The legacy disaster map is configured but its hazard boundaries cannot be loaded without DATABASE_URL.", 503, "LEGACY_HAZARDS_UNAVAILABLE");
    return [];
  }

  transaction<T>(operation: (state: HazardState) => T): Promise<T> {
    return this.serialize(async () => {
      const state = await this.load();
      const result = operation(state);
      if (result instanceof Promise) throw new HazardError("Hazard transactions must not contain asynchronous work.", 500, "ASYNC_TRANSACTION");
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, "wx", 0o600);
        try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, this.file);
      } finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
      return structuredClone(result);
    });
  }
}

export class PostgresHazardStore implements HazardStore {
  readonly mode = "postgres" as const;
  constructor(private readonly pool: Pool, private readonly seed: HazardState = initialState()) {}

  async read(): Promise<HazardState> {
    const result = await this.pool.query("SELECT payload FROM hazard_state WHERE id = 1");
    return result.rows[0] ? validateState(result.rows[0].payload) : structuredClone(this.seed);
  }

  async legacyHazards(): Promise<{ id: string; geometry: unknown }[]> {
    // Match the active/monitoring disasters shown by the existing AppSync map.
    // Null boundaries are deliberately returned: route screening must fail closed on missing geometry.
    const result = await this.pool.query("SELECT id::text, ST_AsGeoJSON(affected_area::geometry) AS geometry FROM disasters WHERE status IS DISTINCT FROM 'resolved'");
    return result.rows;
  }

  async transaction<T>(operation: (state: HazardState) => T): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO hazard_state (id, payload) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING", [JSON.stringify(this.seed)]);
      const result = await client.query("SELECT payload FROM hazard_state WHERE id = 1 FOR UPDATE");
      const state = validateState(result.rows[0].payload);
      const value = operation(state);
      if (value instanceof Promise) throw new HazardError("Hazard transactions must not contain asynchronous work.", 500, "ASYNC_TRANSACTION");
      await client.query("UPDATE hazard_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(state)]);
      await client.query("COMMIT");
      return structuredClone(value);
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }
}

export async function createHazardStore(): Promise<HazardStore> {
  const allowDemo = process.env.HAZARD_DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
  let shelters: Shelter[] = allowDemo ? DEMO_SHELTERS : [];
  if (process.env.HAZARD_SHELTERS_JSON) {
    try { shelters = parse(z.array(shelterSchema).max(100), JSON.parse(process.env.HAZARD_SHELTERS_JSON)); }
    catch { throw new HazardError("HAZARD_SHELTERS_JSON must be a valid array of configured shelter records.", 503, "SHELTER_CONFIGURATION"); }
    if (new Set(shelters.map(shelter => shelter.id)).size !== shelters.length) throw new HazardError("Configured shelter IDs must be unique.", 503, "SHELTER_CONFIGURATION");
  }
  if (process.env.DATABASE_URL) {
    const { Pool: PgPool } = await import("pg");
    const pool = globals.__hazardPgPool ??= new PgPool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 15000 });
    return new PostgresHazardStore(pool, initialState(shelters));
  }
  if (!allowDemo) throw new HazardError("DATABASE_URL is required for production hazard storage. Run db/migrations/002_hazards.sql before starting the service.", 503, "STORAGE_NOT_CONFIGURED");
  return new LocalHazardStore(process.env.HAZARD_STORE_PATH || resolve(process.cwd(), ".data", "hazards.json"), initialState(shelters));
}
