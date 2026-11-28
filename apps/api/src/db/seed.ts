/**
 * First-run setup. Creates the family business, the owner login and the five businesses, with no sample data.
 * Safe to re-run: if a business already exists it does nothing, so real data is never wiped.
 */
import { db, libsql } from "./client";
import * as s from "./schema";
import { runMigrations } from "./migrate";
import { hashPassword } from "../lib/password";
import { ensureDefaults } from "../modules/business/service";
import { env } from "../config/env";

await runMigrations();
console.log(`[seed] target: ${env.db.mode}`);
const existing = await db.select({ id: s.tenants.id }).from(s.tenants).limit(1);
if (existing.length) {
  console.log("[seed] a business already exists; nothing changed");
} else {
  const [t] = await db
    .insert(s.tenants)
    .values({ name: "Pujo Parbon", slug: "pujo-parbon", address: "Sarisha, South 24 Parganas, West Bengal", geofenceLat: 22.2701, geofenceLng: 88.2052, geofenceRadiusM: 150 })
    .returning();
  await db.insert(s.users).values({ tenantId: t.id, name: "Owner", email: "owner@pujaparbon.in", passwordHash: await hashPassword("PujaParbon@2026"), role: "OWNER" });
  await ensureDefaults(t.id);
  console.log("[seed] created owner@pujaparbon.in / PujaParbon@2026 (change this password after the first login)");
}
libsql.close();
