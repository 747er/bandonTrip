import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

// Applies migrations to DATABASE_URL, then seeds the first trip if it's missing.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set; nothing to do (local dev uses .data/pglite).");
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("[migrate] Migrations applied.");
  await seed(db);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
