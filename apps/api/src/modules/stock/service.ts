import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { MovementType } from "@pp/shared";
import { db, type Executor } from "../../db/client";
import { products, stockMovements, tripItems, trips, users } from "../../db/schema";
import { audit } from "../../lib/audit";
import { notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

export interface Level { qty: number; valuePaise: number; lastCountAt: number | null }

/** On-hand units and value (at cost) per product, straight from the ledger. */
export async function levels(ex: Executor, tenantId: string, productIds?: string[]) {
  const where = [eq(stockMovements.tenantId, tenantId)];
  if (productIds?.length) where.push(inArray(stockMovements.productId, productIds));
  const rows = await ex
    .select({
      productId: stockMovements.productId,
      qty: sql<number>`coalesce(sum(${stockMovements.qty}), 0)`,
      value: sql<number>`coalesce(sum(${stockMovements.valuePaise}), 0)`,
      lastCount: sql<number | null>`max(case when ${stockMovements.type} = 'COUNT' then ${stockMovements.createdAt} end)`,
    })
    .from(stockMovements)
    .where(and(...where))
    .groupBy(stockMovements.productId);
  return new Map<string, Level>(rows.map((r) => [r.productId, { qty: Number(r.qty), valuePaise: Number(r.value), lastCountAt: r.lastCount ? Number(r.lastCount) : null }]));
}

/** Cost of one unit right now: average of what is on the shelf, or the latest buy price if the shelf is empty. */
export async function unitCost(ex: Executor, tenantId: string, productId: string): Promise<number> {
  const lv = (await levels(ex, tenantId, [productId])).get(productId);
  if (lv && lv.qty > 0) return Math.round(lv.valuePaise / lv.qty);
  const [last] = await ex
    .select({ unit: tripItems.unitCostPaise })
    .from(tripItems)
    .innerJoin(trips, eq(trips.id, tripItems.tripId))
    .where(and(eq(trips.tenantId, tenantId), eq(tripItems.productId, productId)))
    .orderBy(desc(trips.date), desc(trips.createdAt))
    .limit(1);
  return last?.unit ?? 0;
}

export interface MovementInput { productId: string; qty: number; valuePaise: number; type: MovementType; refType?: string; refId?: string; note?: string }

export async function recordMovement(ex: Executor, c: Ctx, m: MovementInput) {
  const [row] = await ex.insert(stockMovements).values({ tenantId: c.tenantId, userId: c.userId, ...m }).returning();
  return row;
}

/**
 * His daily/two-daily routine: type what is really on the shelf. The difference is written to the ledger
 * (valued at the current average cost) so stock and its value always agree.
 */
export async function applyCounts(c: Ctx, counts: { productId: string; counted: number }[], note?: string) {
  return db.transaction(async (tx) => {
    const ids = counts.map((x) => x.productId);
    const found = await tx.select({ id: products.id }).from(products).where(and(eq(products.tenantId, c.tenantId), inArray(products.id, ids)));
    if (found.length !== new Set(ids).size) throw notFound("Product");
    const lv = await levels(tx, c.tenantId, ids);
    let changed = 0, unitsDown = 0, unitsUp = 0, valueDown = 0, valueUp = 0;
    for (const { productId, counted } of counts) {
      const cur = lv.get(productId) ?? { qty: 0, valuePaise: 0, lastCountAt: null };
      const diff = counted - cur.qty;
      if (diff === 0) {
        // Same number confirmed: still record the check so "last counted" stays honest.
        await recordMovement(tx, c, { productId, qty: 0, valuePaise: 0, type: "COUNT", note: note ?? "Counted, no change" });
        continue;
      }
      const unit = await unitCost(tx, c.tenantId, productId);
      const value = counted === 0 ? -cur.valuePaise : Math.round(diff * (cur.qty > 0 ? cur.valuePaise / cur.qty : unit));
      await recordMovement(tx, c, { productId, qty: diff, valuePaise: value, type: "COUNT", note: note ?? `Counted ${counted} (was ${cur.qty})` });
      changed++;
      if (diff < 0) { unitsDown += -diff; valueDown += -value; } else { unitsUp += diff; valueUp += value; }
    }
    await audit(tx, c, "stock.count", "stock", undefined, { products: counts.length, changed });
    return { checked: counts.length, changed, unitsDown, unitsUp, valueDownPaise: valueDown, valueUpPaise: valueUp };
  });
}

export async function ledger(tenantId: string, q: { productId?: string; limit?: number }) {
  const where = [eq(stockMovements.tenantId, tenantId)];
  if (q.productId) where.push(eq(stockMovements.productId, q.productId));
  return db
    .select({
      id: stockMovements.id, qty: stockMovements.qty, valuePaise: stockMovements.valuePaise, type: stockMovements.type, note: stockMovements.note,
      refType: stockMovements.refType, refId: stockMovements.refId, createdAt: stockMovements.createdAt, productId: products.id, name: products.name,
      category: products.category, by: users.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(and(...where))
    .orderBy(desc(stockMovements.createdAt))
    .limit(Math.min(q.limit ?? 100, 500));
}

export async function setPrices(c: Ctx, prices: { productId: string; sellingPricePaise: number }[]) {
  await db.transaction(async (tx) => {
    for (const p of prices) {
      const res = await tx.update(products).set({ sellingPricePaise: p.sellingPricePaise }).where(and(eq(products.id, p.productId), eq(products.tenantId, c.tenantId)));
      if (!res.rowsAffected) throw notFound("Product");
    }
    await audit(tx, c, "price.update", "product", undefined, { count: prices.length });
  });
  return { ok: true };
}
