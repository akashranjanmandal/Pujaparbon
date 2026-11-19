import { and, desc, eq } from "drizzle-orm";
import type { SettingsInput } from "@pp/shared";
import type { z } from "zod";
import type { userCreateSchema } from "@pp/shared";
import { db } from "../../db/client";
import { auditLogs, employees, refreshTokens, tenants, users } from "../../db/schema";
import { badRequest, notFound, unauthorized } from "../../lib/errors";
import { audit } from "../../lib/audit";
import { hashPassword, verifyPassword } from "../../lib/password";
import type { AuthContext } from "../../lib/http";

export async function getSettings(tenantId: string) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!t) throw notFound("Business");
  return t;
}

export async function updateSettings(c: AuthContext, input: SettingsInput) {
  const [t] = await db.update(tenants).set({ ...input, address: input.address ?? null }).where(eq(tenants.id, c.tenantId)).returning();
  await audit(db, c, "settings.update", "tenant", c.tenantId);
  return t;
}

/** Never returns password hashes. */
export async function listUsers(tenantId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, employeeId: users.employeeId, hasDevice: users.deviceId, lastLoginAt: users.lastLoginAt, employeeName: employees.name })
    .from(users)
    .leftJoin(employees, eq(employees.id, users.employeeId))
    .where(eq(users.tenantId, tenantId))
    .orderBy(users.role, users.name)
    .then((rows) => rows.map((r) => ({ ...r, hasDevice: !!r.hasDevice })));
}

export async function createUser(c: AuthContext, input: z.infer<typeof userCreateSchema>) {
  if (input.role === "STAFF" && !input.employeeId) throw badRequest("Link an employee login to an employee record");
  if (input.employeeId) {
    const [e] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, c.tenantId)));
    if (!e) throw notFound("Employee");
  }
  const [u] = await db
    .insert(users)
    .values({ tenantId: c.tenantId, name: input.name, email: input.email, role: input.role, employeeId: input.employeeId ?? null, passwordHash: await hashPassword(input.password) })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  await audit(db, c, "user.create", "user", u.id, { role: input.role });
  return u;
}

export async function updateUser(c: AuthContext, id: string, input: { active?: boolean; resetDevice?: boolean; password?: string }) {
  if (id === c.userId && input.active === false) throw badRequest("You cannot disable your own login");
  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.active !== undefined) patch.active = input.active;
  if (input.resetDevice) patch.deviceId = null;
  if (input.password) patch.passwordHash = await hashPassword(input.password);
  const [u] = await db.update(users).set(patch).where(and(eq(users.id, id), eq(users.tenantId, c.tenantId))).returning({ id: users.id });
  if (!u) throw notFound("User");
  if (input.active === false || input.password) await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, id));
  await audit(db, c, "user.update", "user", id, { active: input.active, resetDevice: input.resetDevice, passwordChanged: !!input.password });
  return { ok: true };
}

export async function changeOwnPassword(c: AuthContext, current: string, next: string) {
  const [u] = await db.select().from(users).where(eq(users.id, c.userId));
  if (!u || !(await verifyPassword(u.passwordHash, current))) throw unauthorized("Current password is not correct");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, c.userId));
  await audit(db, c, "password.change", "user", c.userId);
  return { ok: true };
}

export async function auditTrail(tenantId: string) {
  return db
    .select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, meta: auditLogs.meta, createdAt: auditLogs.createdAt, by: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.tenantId, tenantId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);
}
