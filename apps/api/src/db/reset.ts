/** Drops every table so the schema can be rebuilt from migrations. Demo/dev use only. */
import { libsql } from "./client";
import { env } from "../config/env";

const rows = (await libsql.execute("select name, type from sqlite_master where name not like 'sqlite_%' and name not like '_litestream%'")).rows;
const drops = rows
  .filter((r) => ["table", "view"].includes(String(r.type)))
  .map((r) => `drop ${String(r.type)} if exists "${String(r.name)}"`);
// One transaction with deferred foreign keys: a per-statement `pragma foreign_keys = off`
// does not persist across separate HTTP calls to Turso.
await libsql.batch(["pragma defer_foreign_keys = on", ...drops], "write");
console.log(`[reset] dropped ${drops.length} objects (${env.db.mode})`);
libsql.close();
