import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";
import { env } from "../config/env";

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.resolve(here, "../../drizzle");

export async function runMigrations() {
  await migrate(db, { migrationsFolder });
  // Every account gets its businesses, and rows from before businesses existed get an owner.
  const { ensureAllTenants } = await import("../modules/business/service");
  await ensureAllTenants();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => console.log(`[db] migrations applied (${env.db.mode})`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
