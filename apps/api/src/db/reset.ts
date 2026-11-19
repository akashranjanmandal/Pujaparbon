/** Drops every table so the schema can be rebuilt from migrations. Demo/dev use only. */
import { libsql } from "./client";
import { env } from "../config/env";

const rows = (await libsql.execute("select name, type from sqlite_master where name not like 'sqlite_%' and name not like '_litestream%'")).rows;
await libsql.execute("pragma foreign_keys = off").catch(() => undefined);
for (const r of rows) {
  const kind = String(r.type) === "view" ? "view" : "table";
  if (String(r.type) === "index" || String(r.type) === "trigger") continue;
  await libsql.execute(`drop ${kind} if exists "${String(r.name)}"`);
}
console.log(`[reset] dropped ${rows.filter((r) => ["table", "view"].includes(String(r.type))).length} objects (${env.db.mode})`);
libsql.close();
