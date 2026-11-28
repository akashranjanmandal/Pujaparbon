import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { pctOver, type ProductInput } from "@pp/shared";
import { db } from "../../db/client";
import { platformSales, platforms, products, stockMovements, tripItems, trips } from "../../db/schema";
import { audit } from "../../lib/audit";
import { newProductCode } from "../../lib/codes";
import { conflict, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { assertBusiness } from "../business/service";
import { levels, recordMovement } from "../stock/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

export interface ProductRow {
  id: string; code: string; name: string; category: string; unit: string; sellingPricePaise: number; wholesalePricePaise: number; gstPct: number; businessId: string | null; notes: string | null;
  onHand: number; valuePaise: number; avgCostPaise: number; marginPct: number; lastCountAt: number | null;
}

export async function list(tenantId: string, q: { search?: string; category?: string; businessId?: string }) {
  const where = [eq(products.tenantId, tenantId), isNull(products.archivedAt)];
  if (q.category) where.push(eq(products.category, q.category));
  // A business sees its own items and the shared ones.
  if (q.businessId) where.push(or(eq(products.businessId, q.businessId), isNull(products.businessId))!);
  if (q.search) {
    const s = `%${q.search}%`;
    where.push(or(like(products.name, s), like(products.code, s), like(products.category, s))!);
  }
  const [rows, lv] = await Promise.all([db.select().from(products).where(and(...where)).orderBy(products.category, products.name), levels(db, tenantId)]);
  const items: ProductRow[] = rows.map((p) => {
    const l = lv.get(p.id) ?? { qty: 0, valuePaise: 0, lastCountAt: null };
    const avg = l.qty > 0 ? Math.round(l.valuePaise / l.qty) : 0;
    return {
      id: p.id, code: p.code, name: p.name, category: p.category, unit: p.unit, sellingPricePaise: p.sellingPricePaise, wholesalePricePaise: p.wholesalePricePaise, gstPct: p.gstPct, businessId: p.businessId, notes: p.notes,
      onHand: l.qty, valuePaise: l.valuePaise, avgCostPaise: avg, marginPct: pctOver(avg, p.sellingPricePaise), lastCountAt: l.lastCountAt,
    };
  });
  return { items, categories: await categories(tenantId), totals: totals(items) };
}

const totals = (items: ProductRow[]) => ({
  products: items.length,
  units: items.reduce((s, i) => s + Math.max(0, i.onHand), 0),
  valuePaise: items.reduce((s, i) => s + i.valuePaise, 0),
  potentialPaise: items.reduce((s, i) => s + Math.max(0, i.onHand) * i.sellingPricePaise, 0),
  lastCountAt: items.reduce<number | null>((m, i) => (i.lastCountAt && (!m || i.lastCountAt > m) ? i.lastCountAt : m), null),
});

/** Categories exist only because products use them. */
export async function categories(tenantId: string) {
  const [rows, lv] = await Promise.all([
    db.select({ id: products.id, category: products.category }).from(products).where(and(eq(products.tenantId, tenantId), isNull(products.archivedAt))),
    levels(db, tenantId),
  ]);
  const map = new Map<string, { name: string; products: number; units: number; valuePaise: number }>();
  for (const r of rows) {
    const e = map.get(r.category) ?? { name: r.category, products: 0, units: 0, valuePaise: 0 };
    const l = lv.get(r.id);
    e.products++;
    e.units += Math.max(0, l?.qty ?? 0);
    e.valuePaise += l?.valuePaise ?? 0;
    map.set(r.category, e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function renameCategory(c: Ctx, from: string, to: string) {
  const res = await db.update(products).set({ category: to }).where(and(eq(products.tenantId, c.tenantId), eq(products.category, from)));
  if (!res.rowsAffected) throw notFound("Category");
  await audit(db, c, "category.rename", "category", undefined, { from, to });
  return { renamed: res.rowsAffected };
}

export async function get(tenantId: string, ref: string) {
  const [p] = await db.select().from(products).where(and(eq(products.tenantId, tenantId), or(eq(products.id, ref), eq(products.code, ref))));
  if (!p) throw notFound("Product");
  const l = (await levels(db, tenantId, [p.id])).get(p.id) ?? { qty: 0, valuePaise: 0, lastCountAt: null };
  const avg = l.qty > 0 ? Math.round(l.valuePaise / l.qty) : 0;
  const lots = await db
    .select({
      tripId: trips.id, code: trips.code, date: trips.date, place: trips.place, title: trips.title, qty: tripItems.qty, landedPaise: tripItems.landedPaise,
      unitCostPaise: tripItems.unitCostPaise, unitPricePaise: tripItems.unitPricePaise,
    })
    .from(tripItems)
    .innerJoin(trips, eq(trips.id, tripItems.tripId))
    .where(and(eq(trips.tenantId, tenantId), eq(tripItems.productId, p.id)))
    .orderBy(sql`${trips.date} desc`);
  const sales = await db
    .select({
      platform: platforms.name, color: platforms.color, units: sql<number>`sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.qty} else 0 end)`,
      netPaise: sql<number>`sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.netPaise} else 0 end)`,
      costPaise: sql<number>`sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.costPaise} else 0 end)`,
      returns: sql<number>`sum(case when ${platformSales.status} in ('RETURNED', 'RTO') then ${platformSales.qty} else 0 end)`,
    })
    .from(platformSales)
    .innerJoin(platforms, eq(platforms.id, platformSales.platformId))
    .where(and(eq(platformSales.tenantId, tenantId), eq(platformSales.productId, p.id)))
    .groupBy(platforms.id);
  return {
    ...p,
    onHand: l.qty, valuePaise: l.valuePaise, avgCostPaise: avg, marginPct: pctOver(avg, p.sellingPricePaise), lastCountAt: l.lastCountAt,
    lots,
    sales: sales.map((s) => ({ ...s, units: Number(s.units), netPaise: Number(s.netPaise), costPaise: Number(s.costPaise), returns: Number(s.returns) })),
  };
}

export async function create(c: Ctx, input: ProductInput) {
  await assertBusiness(c.tenantId, input.businessId);
  const id = await db.transaction(async (tx) => {
    const [dup] = await tx.select({ id: products.id }).from(products).where(and(eq(products.tenantId, c.tenantId), eq(products.name, input.name), eq(products.category, input.category), isNull(products.archivedAt)));
    if (dup) throw conflict(`"${input.name}" already exists in ${input.category}`);
    const [p] = await tx
      .insert(products)
      .values({ tenantId: c.tenantId, code: await newProductCode(tx, c.tenantId), name: input.name, category: input.category, unit: input.unit, sellingPricePaise: input.sellingPricePaise, wholesalePricePaise: input.wholesalePricePaise, gstPct: input.gstPct, businessId: input.businessId ?? null, notes: input.notes ?? null })
      .returning({ id: products.id });
    if (input.openingQty > 0) {
      await recordMovement(tx, c, { productId: p.id, qty: input.openingQty, valuePaise: input.openingQty * input.openingUnitCostPaise, type: "OPENING", note: "Opening stock" });
    }
    await audit(tx, c, "product.create", "product", p.id, { name: input.name });
    return p.id;
  });
  return get(c.tenantId, id);
}

export async function update(c: Ctx, id: string, input: Partial<Pick<ProductInput, "name" | "category" | "unit" | "sellingPricePaise" | "wholesalePricePaise" | "gstPct" | "businessId" | "notes">>) {
  await assertBusiness(c.tenantId, input.businessId);
  const res = await db.update(products).set(input).where(and(eq(products.id, id), eq(products.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Product");
  await audit(db, c, "product.update", "product", id);
  return get(c.tenantId, id);
}

/** Products with history are archived, not deleted, so past buys and sales still add up. */
export async function archive(c: Ctx, id: string) {
  const res = await db.update(products).set({ archivedAt: new Date() }).where(and(eq(products.id, id), eq(products.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Product");
  await audit(db, c, "product.archive", "product", id);
  return { ok: true };
}

export const movementsFor = (tenantId: string, productId: string) => db.select().from(stockMovements).where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.productId, productId)));
