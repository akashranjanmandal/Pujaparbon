import { and, eq, isNull } from "drizzle-orm";
import { DEFAULT_BUSINESSES, type BusinessInput, type LocationInput } from "@pp/shared";
import { db } from "../../db/client";
import { businesses, courierMoves, investments, locations, packagingMaterials, parties, platforms, products, tenants, trips } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, conflict, isUniqueViolation, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { requireBusiness } from "../../lib/isolation";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

/** The family's five businesses exist from the start; the owner can rename or add to them. */
export async function ensureDefaults(tenantId: string) {
  const have = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.tenantId, tenantId)).limit(1);
  if (have.length) return assignLegacy(tenantId);
  await db.insert(businesses).values(DEFAULT_BUSINESSES.map((b, i) => ({ ...b, tenantId, createdAt: new Date(Date.now() + i) }))).onConflictDoNothing();
  await assignLegacy(tenantId);
}

/**
 * Data entered before businesses existed was all marketplace selling, so it moves to the online business once.
 * From then on every record must name its business.
 */
export async function assignLegacy(tenantId: string) {
  const [online] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.tenantId, tenantId), eq(businesses.kind, "ONLINE"))).limit(1);
  if (!online) return;
  for (const t of [products, trips, investments, platforms, parties, locations, packagingMaterials, courierMoves]) {
    await db.update(t).set({ businessId: online.id } as never).where(and(eq(t.tenantId, tenantId), isNull(t.businessId)));
  }
}

/** Run after migrations so existing accounts get their businesses and legacy rows an owner. */
export async function ensureAllTenants() {
  for (const t of await db.select({ id: tenants.id }).from(tenants)) await ensureDefaults(t.id);
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

export const listLocations = (tenantId: string, businessId: string) => db.select().from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.businessId, businessId))).orderBy(locations.kind, locations.name);

export async function createLocation(c: Ctx, input: LocationInput) {
  await requireBusiness(db, c.tenantId, input.businessId);
  try {
    const [l] = await db.insert(locations).values({ ...input, tenantId: c.tenantId }).returning();
    await audit(db, c, "location.create", "location", l.id, { name: l.name });
    return l;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict(`${input.name} already exists`);
    throw e;
  }
}

export async function updateLocation(c: Ctx, id: string, input: Partial<Omit<LocationInput, "businessId">>) {
  const res = await db.update(locations).set(input).where(and(eq(locations.id, id), eq(locations.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Place");
  await audit(db, c, "location.update", "location", id);
  const [l] = await db.select().from(locations).where(eq(locations.id, id));
  return l;
}

