import { and, eq, gt, isNull } from "drizzle-orm";
import { ASSIGNABLE_PERMISSIONS, ROLE_PERMISSIONS, checkGeofence, type LoginInput, type Permission, type Role } from "@pp/shared";
import { db } from "../../db/client";
import { employees, refreshTokens, roles, tenants, users } from "../../db/schema";
import { unauthorized, AppError } from "../../lib/errors";
import { verifyPassword } from "../../lib/password";
import { hashToken, newRefreshToken, signAccessToken } from "../../lib/tokens";
import { env } from "../../config/env";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

type UserRow = typeof users.$inferSelect;

/** The owner holds everything; an employee holds check-in plus whatever their role allows (never money screens). */
export async function permsFor(user: UserRow): Promise<Permission[]> {
  const base = [...ROLE_PERMISSIONS[user.role as Role]];
  if (!user.roleId) return base;
  const [r] = await db.select({ p: roles.permissions }).from(roles).where(eq(roles.id, user.roleId));
  const granted = (JSON.parse(r?.p ?? "[]") as Permission[]).filter((p) => (ASSIGNABLE_PERMISSIONS as readonly string[]).includes(p));
  return [...new Set([...base, ...granted])];
}

async function issueTokens(user: UserRow) {
  const accessToken = signAccessToken({ sub: user.id, tid: user.tenantId, role: user.role, eid: user.employeeId, perms: await permsFor(user) });
  const refreshToken = newRefreshToken();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000),
  });
  return { accessToken, refreshToken, user: await profile(user) };
}

export async function profile(user: UserRow) {
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, user.tenantId));
  const emp = user.employeeId
    ? (await db.select({ designation: employees.designation, avatarHue: employees.avatarHue }).from(employees).where(eq(employees.id, user.employeeId)))[0]
    : undefined;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    employeeId: user.employeeId,
    designation: emp?.designation ?? (user.role === "OWNER" ? "Owner" : "Employee"),
    avatarHue: emp?.avatarHue ?? 20,
    tenant: tenant ?? null,
    permissions: await permsFor(user),
  };
}

export async function login(input: LoginInput) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email));
  // Same message for unknown email and wrong password: no account enumeration.
  const invalid = unauthorized("Email or password is incorrect");
  if (!user || !user.active) throw invalid;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, "LOCKED", "Too many failed attempts. Try again in a few minutes.");
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const fails = user.failedLogins + 1;
    await db
      .update(users)
      .set({ failedLogins: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
      .where(eq(users.id, user.id));
    throw invalid;
  }
  // Employees can only sign in from the shop. The owner can sign in from anywhere.
  if (user.role !== "OWNER") {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId));
    if (!input.location) throw new AppError(403, "LOCATION_REQUIRED", "Turn on location to sign in. Employees can only sign in at the shop.");
    const fence = checkGeofence({ ...input.location, accuracyM: input.location.accuracyM }, { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM });
    if (!fence.allowed) throw new AppError(403, "OUTSIDE_SHOP", fence.reason === "LOW_ACCURACY"
        ? "Your location is too imprecise. Step near a window or turn on precise location."
        : `You are ${fence.distanceM} m from the shop. Employees can only sign in at the shop.`);
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return issueTokens(user);
}

/** Rotation: each refresh token works once. Reuse of a revoked token revokes the whole family for that user. */
export async function refresh(token: string | undefined) {
  if (!token) throw unauthorized();
  const hash = hashToken(token);
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash));
  if (!row) throw unauthorized();
  if (row.revokedAt) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized("Session was reused. Please sign in again.");
  }
  if (row.expiresAt < new Date()) throw unauthorized();
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
  const [user] = await db.select().from(users).where(eq(users.id, row.userId));
  if (!user || !user.active) throw unauthorized();
  return issueTokens(user);
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hashToken(token)), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
}

export async function me(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw unauthorized();
  return profile(user);
}

export async function fence() {
  const [t] = await db.select({ lat: tenants.geofenceLat, lng: tenants.geofenceLng, radiusM: tenants.geofenceRadiusM }).from(tenants).limit(1);
  return t ?? null;
}
