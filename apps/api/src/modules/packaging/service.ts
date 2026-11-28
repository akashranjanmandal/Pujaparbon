import { and, eq, isNull } from "drizzle-orm";
import type { MaterialInput } from "@pp/shared";
import { db } from "../../db/client";
import { packagingMaterials, products } from "../../db/schema";
import { audit } from "../../lib/audit";
import { requireBusiness } from "../../lib/isolation";
import { notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { levels } from "../stock/service";

/** The packing team's page: how many of each item are in stock, and the packing materials. Never any money. */
export async function overview(tenantId: string, businessId: string) {
  const [prods, lv, materials] = await Promise.all([
    db.select({ id: products.id, name: products.name, category: products.category, unit: products.unit }).from(products).where(and(eq(products.tenantId, tenantId), eq(products.businessId, businessId), isNull(products.archivedAt))).orderBy(products.name),
    levels(db, tenantId),
    db.select().from(packagingMaterials).where(and(eq(packagingMaterials.tenantId, tenantId), eq(packagingMaterials.businessId, businessId))).orderBy(packagingMaterials.name),
  ]);
  const items = prods.map((p) => ({ ...p, onHand: lv.get(p.id)?.qty ?? 0 })).filter((p) => p.onHand > 0);
  const mats = materials.map((m) => ({ id: m.id, name: m.name, unit: m.unit, qty: m.qty, minQty: m.minQty, low: m.qty <= m.minQty }));
  return { items, materials: mats, needBuying: mats.filter((m) => m.low) };
}

export async function addMaterial(c: AuthContext, input: MaterialInput) {
  await requireBusiness(db, c.tenantId, input.businessId);
  const [m] = await db.insert(packagingMaterials).values({ ...input, tenantId: c.tenantId }).returning();
  await audit(db, c, "packaging.add", "packaging", m.id);
  return m;
}

export async function updateMaterial(c: AuthContext, id: string, input: Partial<MaterialInput>) {
  const [m] = await db.update(packagingMaterials).set({ ...input, updatedAt: new Date() }).where(and(eq(packagingMaterials.id, id), eq(packagingMaterials.tenantId, c.tenantId))).returning();
  if (!m) throw notFound("Packing material");
  return m;
}

export async function removeMaterial(c: AuthContext, id: string) {
  const [m] = await db.delete(packagingMaterials).where(and(eq(packagingMaterials.id, id), eq(packagingMaterials.tenantId, c.tenantId))).returning({ id: packagingMaterials.id });
  if (!m) throw notFound("Packing material");
  return { ok: true };
}
