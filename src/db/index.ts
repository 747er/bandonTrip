import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * With DATABASE_URL set (Vercel / Neon / any Postgres) we connect with node-postgres
 * and expect migrations to have been applied by `npm run db:migrate`.
 *
 * Without it we run an embedded Postgres (PGlite) persisted under .data/, migrate it
 * on first use and seed the initial trip, so local development needs no setup.
 */
async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzle(pool, { schema });
  }

  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres database to this Vercel project.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const pglite = drizzle(client, { schema });
  await migrate(pglite, { migrationsFolder: MIGRATIONS });
  const db = pglite as unknown as Db;
  const { seed } = await import("./seed");
  await seed(db);
  return db;
}

const globalForDb = globalThis as unknown as { __bandonDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__bandonDb) {
    globalForDb.__bandonDb = connect().catch((err) => {
      globalForDb.__bandonDb = undefined;
      throw err;
    });
  }
  return globalForDb.__bandonDb;
}

export { schema };
