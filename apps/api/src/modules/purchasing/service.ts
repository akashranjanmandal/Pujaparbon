import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PurchaseInput } from "@pp/shared";
import type { z } from "zod";
import type { supplierSchema } from "@pp/shared";
import { db } from "../../db/client";
import { products, purchaseItems, purchases, suppliers, variants } from "../../db/schema";
import { notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import { nextNumber } from "../../lib/numbering";
import type { AuthContext } from "../../lib/http";
import { recordMovement } from "../stock/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

export async function listSuppliers(tenantId: string) {
  const rows = await db
    .select({
      supplier: suppliers,
      purchases: sql<number>`count(${purchases.id})`,
      spentPaise: sql<number>`coalesce(sum(${purchases.totalPaise}), 0)`,
      lastPurchase: sql<string | null>`max(${purchases.date})`,
    })
    .from(suppliers)
    .leftJoin(purchases, eq(purchases.supplierId, suppliers.id))
    .where(eq(suppliers.tenantId, tenantId))
    .groupBy(suppliers.id)
    .orderBy(suppliers.name);
  return rows.map((r) => ({ ...r.supplier, purchases: Number(r.purchases), spentPaise: Number(r.spentPaise), lastPurchase: r.lastPurchase }));
}

export async function createSupplier(c: Ctx, input: z.infer<typeof supplierSchema>) {
  const [row] = await db.insert(suppliers).values({ ...input, tenantId: c.tenantId }).returning();
  await audit(db, c, "supplier.create", "supplier", row.id);
  return row;
}

export async function updateSupplier(c: Ctx, id: string, input: z.infer<typeof supplierSchema>) {
  const [row] = await db.update(suppliers).set(input).where(and(eq(suppliers.id, id), eq(suppliers.tenantId, c.tenantId))).returning();
  if (!row) throw notFound("Supplier");
  return row;
}

export async function listPurchases(tenantId: string, supplierId?: string) {
  const where = [eq(purchases.tenantId, tenantId)];
  if (supplierId) where.push(eq(purchases.supplierId, supplierId));
  const rows = await db
    .select({ p: purchases, supplierName: suppliers.name, items: sql<number>`(select coalesce(sum(qty),0) from purchase_items i where i.purchase_id = ${purchases.id})` })
    .from(purchases)
    .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .where(and(...where))
    .orderBy(desc(purchases.date), desc(purchases.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r.p, supplierName: r.supplierName, units: Number(r.items) }));
}

export async function getPurchase(tenantId: string, id: string) {
  const [p] = await db
    .select({ p: purchases, supplierName: suppliers.name })
    .from(purchases)
    .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .where(and(eq(purchases.id, id), eq(purchases.tenantId, tenantId)));
  if (!p) throw notFound("Purchase");
  const items = await db
    .select({ id: purchaseItems.id, qty: purchaseItems.qty, costPaise: purchaseItems.costPaise, sku: variants.sku, name: products.name, emoji: products.emoji })
    .from(purchaseItems)
    .innerJoin(variants, eq(variants.id, purchaseItems.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(purchaseItems.purchaseId, id));
  return { ...p.p, supplierName: p.supplierName, items };
}

/** Saving a purchase adds stock in the same transaction and refreshes each SKU's cost price. */
export async function createPurchase(c: Ctx, input: PurchaseInput) {
  const id = await db.transaction(async (tx) => {
    const [s] = await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, c.tenantId)));
    if (!s) throw notFound("Supplier");
    const known = await tx.select({ id: variants.id }).from(variants).where(and(eq(variants.tenantId, c.tenantId), inArray(variants.id, input.items.map((i) => i.variantId))));
    if (known.length !== new Set(input.items.map((i) => i.variantId)).size) throw notFound("SKU");

    const totalPaise = input.items.reduce((sum, i) => sum + i.qty * i.costPaise, 0);
    const [p] = await tx
      .insert(purchases)
      .values({ tenantId: c.tenantId, supplierId: input.supplierId, number: await nextNumber(tx, c.tenantId, "PO"), invoiceNo: input.invoiceNo, date: input.date, notes: input.notes ?? null, totalPaise, createdById: c.userId })
      .returning();
    for (const item of input.items) {
      await tx.insert(purchaseItems).values({ purchaseId: p.id, ...item, binId: item.binId ?? null });
      await recordMovement(tx, c, { variantId: item.variantId, binId: item.binId, qty: item.qty, type: "PURCHASE", reason: `Purchase ${p.number}`, refType: "purchase", refId: p.id });
      await tx.update(variants).set({ costPaise: item.costPaise }).where(eq(variants.id, item.variantId));
    }
    await audit(tx, c, "purchase.create", "purchase", p.id, { totalPaise });
    return p.id;
  });
  return getPurchase(c.tenantId, id);
}
