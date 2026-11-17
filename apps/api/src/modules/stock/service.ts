import { and, desc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import type { MovementType, StockMoveInput } from "@pp/shared";
import { db, type Executor } from "../../db/client";
import { bins, orderItems, orders, products, stockMovements, users, variants } from "../../db/schema";
import { conflict, notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import type { AuthContext } from "../../lib/http";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

export interface MovementInput {
  variantId: string;
  binId?: string | null;
  qty: number;
  type: MovementType;
  reason?: string;
  refType?: string;
  refId?: string;
}

/** On-hand quantity per variant (sum of the ledger). */
export async function levels(ex: Executor, tenantId: string, variantIds?: string[]) {
  const where = [eq(stockMovements.tenantId, tenantId)];
  if (variantIds?.length) where.push(inArray(stockMovements.variantId, variantIds));
  const rows = await ex
    .select({ variantId: stockMovements.variantId, qty: sql<number>`coalesce(sum(${stockMovements.qty}), 0)` })
    .from(stockMovements)
    .where(and(...where))
    .groupBy(stockMovements.variantId);
  return new Map(rows.map((r) => [r.variantId, Number(r.qty)]));
}

/** Units promised to open orders that have not left the warehouse yet. */
export async function committed(ex: Executor, tenantId: string) {
  const rows = await ex
    .select({ variantId: orderItems.variantId, qty: sql<number>`sum(${orderItems.qty})` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.tenantId, tenantId), inArray(orders.status, ["NEW", "PICKED", "PACKED"])))
    .groupBy(orderItems.variantId);
  return new Map(rows.filter((r) => r.variantId).map((r) => [r.variantId!, Number(r.qty)]));
}

/** The single write path for stock. Refuses to take a variant below zero. */
export async function recordMovement(ex: Executor, c: Ctx, m: MovementInput) {
  const [v] = await ex
    .select({ id: variants.id, sku: variants.sku })
    .from(variants)
    .where(and(eq(variants.id, m.variantId), eq(variants.tenantId, c.tenantId)));
  if (!v) throw notFound("SKU");
  if (m.binId) {
    const [b] = await ex.select({ id: bins.id }).from(bins).where(and(eq(bins.id, m.binId), eq(bins.tenantId, c.tenantId)));
    if (!b) throw notFound("Bin");
  }
  if (m.qty < 0) {
    const onHand = (await levels(ex, c.tenantId, [m.variantId])).get(m.variantId) ?? 0;
    if (onHand + m.qty < 0) throw conflict(`Only ${onHand} unit(s) of ${v.sku} in stock`);
  }
  const [row] = await ex
    .insert(stockMovements)
    .values({ tenantId: c.tenantId, userId: c.userId, ...m, binId: m.binId ?? null })
    .returning();
  return row;
}

export async function move(c: Ctx, input: StockMoveInput) {
  const qty = input.type === "OUTWARD" ? -Math.abs(input.qty) : input.type === "INWARD" ? Math.abs(input.qty) : input.qty;
  return db.transaction(async (tx) => {
    const row = await recordMovement(tx, c, { ...input, qty });
    await audit(tx, c, `stock.${input.type.toLowerCase()}`, "variant", input.variantId, { qty, reason: input.reason });
    return row;
  });
}

export async function list(tenantId: string, q: { search?: string; category?: string; filter?: "low" | "out" | "all" }) {
  const where: SQL[] = [eq(variants.tenantId, tenantId), isNull(variants.deletedAt), isNull(products.deletedAt)];
  if (q.search) {
    const s = `%${q.search}%`;
    where.push(or(like(products.name, s), like(variants.sku, s), like(products.category, s))!);
  }
  if (q.category) where.push(eq(products.category, q.category));
  const rows = await db
    .select({
      variantId: variants.id,
      sku: variants.sku,
      size: variants.size,
      color: variants.color,
      reorderLevel: variants.reorderLevel,
      costPaise: variants.costPaise,
      pricePaise: variants.pricePaise,
      productId: products.id,
      name: products.name,
      category: products.category,
      emoji: products.emoji,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(...where))
    .orderBy(products.name, variants.sku);

  const [lv, com, binRows] = await Promise.all([
    levels(db, tenantId),
    committed(db, tenantId),
    db
      .select({ variantId: stockMovements.variantId, code: bins.code, qty: sql<number>`sum(${stockMovements.qty})` })
      .from(stockMovements)
      .innerJoin(bins, eq(bins.id, stockMovements.binId))
      .where(eq(stockMovements.tenantId, tenantId))
      .groupBy(stockMovements.variantId, bins.code),
  ]);
  const binsByVariant = new Map<string, { code: string; qty: number }[]>();
  for (const b of binRows) {
    if (Number(b.qty) <= 0) continue;
    const arr = binsByVariant.get(b.variantId) ?? [];
    arr.push({ code: b.code, qty: Number(b.qty) });
    binsByVariant.set(b.variantId, arr.sort((a, z) => z.qty - a.qty));
  }

  const items = rows.map((r) => {
    const onHand = lv.get(r.variantId) ?? 0;
    const reserved = com.get(r.variantId) ?? 0;
    const state = onHand <= 0 ? "OUT" : onHand <= r.reorderLevel ? "LOW" : "OK";
    return { ...r, onHand, committed: reserved, available: onHand - reserved, bins: binsByVariant.get(r.variantId) ?? [], state };
  });
  const filtered = q.filter === "low" ? items.filter((i) => i.state !== "OK") : q.filter === "out" ? items.filter((i) => i.state === "OUT") : items;
  return {
    items: filtered,
    totals: {
      skus: items.length,
      units: items.reduce((s, i) => s + Math.max(0, i.onHand), 0),
      valueAtCostPaise: items.reduce((s, i) => s + Math.max(0, i.onHand) * i.costPaise, 0),
      low: items.filter((i) => i.state === "LOW").length,
      out: items.filter((i) => i.state === "OUT").length,
    },
  };
}

export async function ledger(tenantId: string, q: { variantId?: string; type?: string; limit?: number }) {
  const where: SQL[] = [eq(stockMovements.tenantId, tenantId)];
  if (q.variantId) where.push(eq(stockMovements.variantId, q.variantId));
  if (q.type) where.push(eq(stockMovements.type, q.type as MovementType));
  return db
    .select({
      id: stockMovements.id,
      qty: stockMovements.qty,
      type: stockMovements.type,
      reason: stockMovements.reason,
      refType: stockMovements.refType,
      refId: stockMovements.refId,
      createdAt: stockMovements.createdAt,
      sku: variants.sku,
      name: products.name,
      emoji: products.emoji,
      bin: bins.code,
      by: users.name,
    })
    .from(stockMovements)
    .innerJoin(variants, eq(variants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .leftJoin(bins, eq(bins.id, stockMovements.binId))
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(and(...where))
    .orderBy(desc(stockMovements.createdAt))
    .limit(Math.min(q.limit ?? 100, 500));
}

export async function listBins(tenantId: string) {
  const rows = await db
    .select({
      id: bins.id,
      code: bins.code,
      zone: bins.zone,
      units: sql<number>`coalesce((select sum(qty) from stock_movements m where m.bin_id = ${bins.id}), 0)`,
      skus: sql<number>`(select count(*) from (select variant_id from stock_movements m where m.bin_id = ${bins.id} group by variant_id having sum(qty) > 0))`,
    })
    .from(bins)
    .where(eq(bins.tenantId, tenantId))
    .orderBy(bins.code);
  return rows.map((r) => ({ ...r, units: Number(r.units), skus: Number(r.skus) }));
}

export async function createBin(c: Ctx, input: { code: string; zone: string }) {
  const [row] = await db.insert(bins).values({ tenantId: c.tenantId, code: input.code.toUpperCase(), zone: input.zone }).returning();
  return row;
}
