import { and, eq } from "drizzle-orm";
import { DEFAULT_BUSINESSES, type BusinessInput, type LocationInput } from "@pp/shared";
import { db } from "../../db/client";
import { businesses, locations } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, conflict, isUniqueViolation, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

/** The family's five businesses exist from the start; the owner can rename or add to them. */
export async function ensureDefaults(tenantId: string) {
  const have = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.tenantId, tenantId)).limit(1);
  if (have.length) return;
  await db.insert(businesses).values(DEFAULT_BUSINESSES.map((b, i) => ({ ...b, tenantId, createdAt: new Date(Date.now() + i) }))).onConflictDoNothing();
}

export async function listBusinesses(tenantId: string) {
  await ensureDefaults(tenantId);
  return db.select().from(businesses).where(eq(businesses.tenantId, tenantId)).orderBy(businesses.createdAt, businesses.name);
}

export async function createBusiness(c: Ctx, input: BusinessInput) {
  try {
    const [b] = await db.insert(businesses).values({ ...input, tenantId: c.tenantId }).returning();
    await audit(db, c, "business.create", "business", b.id, { name: b.name });
    return b;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict(`${input.name} already exists`);
    throw e;
  }
}

export async function updateBusiness(c: Ctx, id: string, input: Partial<BusinessInput>) {
  const res = await db.update(businesses).set(input).where(and(eq(businesses.id, id), eq(businesses.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Business");
  await audit(db, c, "business.update", "business", id);
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id));
  return b;
}

/** A business id from the outside must belong to this tenant. */
export async function assertBusiness(tenantId: string, id: string | null | undefined) {
  if (!id) return;
  const [b] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.id, id), eq(businesses.tenantId, tenantId)));
  if (!b) throw badRequest("Unknown business");
}

export const listLocations = (tenantId: string) => db.select().from(locations).where(eq(locations.tenantId, tenantId)).orderBy(locations.kind, locations.name);

export async function createLocation(c: Ctx, input: LocationInput) {
  await assertBusiness(c.tenantId, input.businessId);
  try {
    const [l] = await db.insert(locations).values({ ...input, businessId: input.businessId ?? null, tenantId: c.tenantId }).returning();
    await audit(db, c, "location.create", "location", l.id, { name: l.name });
    return l;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict(`${input.name} already exists`);
    throw e;
  }
}

export async function updateLocation(c: Ctx, id: string, input: Partial<LocationInput>) {
  await assertBusiness(c.tenantId, input.businessId);
  const res = await db.update(locations).set(input).where(and(eq(locations.id, id), eq(locations.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Place");
  await audit(db, c, "location.update", "location", id);
  const [l] = await db.select().from(locations).where(eq(locations.id, id));
  return l;
}

/** A place id from the outside must belong to this tenant. */
export async function assertLocationOwn(tenantId: string, id: string | null | undefined) {
  if (!id) return;
  const [l] = await db.select({ id: locations.id }).from(locations).where(and(eq(locations.id, id), eq(locations.tenantId, tenantId)));
  if (!l) throw badRequest("Unknown place");
}
