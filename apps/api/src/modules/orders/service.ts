import { and, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { ORDER_FLOW, type ChannelCode, type OrderStatus, type ReturnInput } from "@pp/shared";
import type { z } from "zod";
import type { manualOrderSchema } from "@pp/shared";
import { db, type Tx } from "../../db/client";
import { channelListings, channels, importBatches, orderItems, orders, products, returns, users, variants } from "../../db/schema";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import type { AuthContext } from "../../lib/http";
import { recordMovement } from "../stock/service";
import type { ParsedOrder, ParseIssue } from "./importer";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

export async function channelByCode(ex: Tx | typeof db, tenantId: string, code: ChannelCode) {
  const [c] = await ex.select().from(channels).where(and(eq(channels.tenantId, tenantId), eq(channels.code, code)));
  if (!c) throw notFound(`Channel ${code}`);
  return c;
}

export async function list(
  tenantId: string,
  q: { status?: string; channel?: string; search?: string; from?: Date; to?: Date; page: number; pageSize: number; offset: number },
) {
  const where: SQL[] = [eq(orders.tenantId, tenantId)];
  if (q.status) where.push(inArray(orders.status, q.status.split(",") as OrderStatus[]));
  if (q.channel) where.push(eq(channels.code, q.channel));
  if (q.from) where.push(gte(orders.orderedAt, q.from));
  if (q.to) where.push(lte(orders.orderedAt, q.to));
  if (q.search) where.push(or(like(orders.channelOrderId, `%${q.search}%`), like(orders.customerName, `%${q.search}%`), like(orders.awb, `%${q.search}%`))!);

  const base = db
    .select({
      o: orders,
      channelCode: channels.code,
      channelName: channels.name,
      channelColor: channels.color,
      units: sql<number>`(select coalesce(sum(qty),0) from order_items i where i.order_id = ${orders.id})`,
      unmapped: sql<number>`(select count(*) from order_items i where i.order_id = ${orders.id} and i.variant_id is null)`,
      firstItem: sql<string>`(select p.name from order_items i join variants v on v.id = i.variant_id join products p on p.id = v.product_id where i.order_id = ${orders.id} limit 1)`,
      emoji: sql<string>`(select p.emoji from order_items i join variants v on v.id = i.variant_id join products p on p.id = v.product_id where i.order_id = ${orders.id} limit 1)`,
    })
    .from(orders)
    .innerJoin(channels, eq(channels.id, orders.channelId))
    .where(and(...where));

  const [rows, [{ total }], counts] = await Promise.all([
    base.orderBy(desc(orders.orderedAt)).limit(q.pageSize).offset(q.offset),
    db.select({ total: sql<number>`count(*)` }).from(orders).innerJoin(channels, eq(channels.id, orders.channelId)).where(and(...where)),
    db.select({ status: orders.status, n: sql<number>`count(*)` }).from(orders).where(eq(orders.tenantId, tenantId)).groupBy(orders.status),
  ]);
  return {
    items: rows.map((r) => ({
      ...r.o,
      channel: { code: r.channelCode, name: r.channelName, color: r.channelColor },
      units: Number(r.units),
      unmapped: Number(r.unmapped),
      firstItem: r.firstItem,
      emoji: r.emoji,
    })),
    total: Number(total),
    page: q.page,
    pageSize: q.pageSize,
    statusCounts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
  };
}

export async function get(tenantId: string, id: string) {
  const [r] = await db
    .select({ o: orders, channelCode: channels.code, channelName: channels.name, channelColor: channels.color })
    .from(orders)
    .innerJoin(channels, eq(channels.id, orders.channelId))
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  if (!r) throw notFound("Order");
  const items = await db
    .select({ id: orderItems.id, variantId: orderItems.variantId, channelSku: orderItems.channelSku, qty: orderItems.qty, pricePaise: orderItems.pricePaise, sku: variants.sku, name: products.name, emoji: products.emoji, size: variants.size })
    .from(orderItems)
    .leftJoin(variants, eq(variants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, variants.productId))
    .where(eq(orderItems.orderId, id));
  const rets = await db.select().from(returns).where(eq(returns.orderId, id));
  return { ...r.o, channel: { code: r.channelCode, name: r.channelName, color: r.channelColor }, items, returns: rets };
}

/** Stock leaves the ledger when an order is dispatched, not when it is imported. */
async function transition(tx: Tx, c: Ctx, id: string, status: OrderStatus, awb?: string) {
  const [o] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.tenantId, c.tenantId)));
  if (!o) throw notFound("Order");
  if (o.status === status) return o;
  if (!ORDER_FLOW[o.status].includes(status)) throw conflict(`Cannot move order ${o.channelOrderId} from ${o.status} to ${status}`);

  if (status === "DISPATCHED") {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
    const unmapped = items.filter((i) => !i.variantId);
    if (unmapped.length) throw conflict(`Map SKU ${unmapped[0].channelSku} to a product before dispatching ${o.channelOrderId}`);
    for (const i of items) {
      await recordMovement(tx, c, { variantId: i.variantId!, qty: -i.qty, type: "SALE", reason: `Dispatched ${o.channelOrderId}`, refType: "order", refId: o.id });
    }
  }
  const [updated] = await tx
    .update(orders)
    .set({ status, ...(status === "DISPATCHED" ? { dispatchedAt: new Date(), awb: awb ?? o.awb } : {}) })
    .where(eq(orders.id, id))
    .returning();
  await audit(tx, c, `order.${status.toLowerCase()}`, "order", id);
  return updated;
}

export const setStatus = (c: Ctx, id: string, status: OrderStatus, awb?: string) =>
  db.transaction((tx) => transition(tx, c, id, status, awb));

/** Each order moves in its own transaction so one bad order does not block the rest. */
export async function bulkStatus(c: Ctx, ids: string[], status: OrderStatus) {
  const results: { id: string; ok: boolean; message?: string }[] = [];
  for (const id of ids) {
    try {
      await db.transaction((tx) => transition(tx, c, id, status));
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, message: (e as Error).message });
    }
  }
  return { updated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) };
}

export async function createManual(c: Ctx, input: z.infer<typeof manualOrderSchema>) {
  return db.transaction(async (tx) => {
    const ch = await channelByCode(tx, c.tenantId, input.channel);
    const vars = await tx.select().from(variants).where(and(eq(variants.tenantId, c.tenantId), inArray(variants.id, input.items.map((i) => i.variantId))));
    const total = input.items.reduce((s, i) => s + i.qty * i.pricePaise, 0);
    const [o] = await tx
      .insert(orders)
      .values({
        tenantId: c.tenantId, channelId: ch.id, channelOrderId: `PP-${Date.now().toString(36).toUpperCase()}`, customerName: input.customerName,
        city: input.city ?? null, state: input.state, status: "NEW", orderedAt: new Date(), totalPaise: total,
      })
      .returning();
    for (const i of input.items) {
      const v = vars.find((x) => x.id === i.variantId);
      if (!v) throw notFound("SKU");
      await tx.insert(orderItems).values({ orderId: o.id, variantId: v.id, channelSku: v.sku, qty: i.qty, pricePaise: i.pricePaise });
    }
    await audit(tx, c, "order.create", "order", o.id);
    return o;
  });
}

/** Map marketplace SKUs to our variants: channel listing first, then our own SKU code. */
async function skuResolver(tenantId: string, channelId: string) {
  const [listings, vars] = await Promise.all([
    db.select({ sku: channelListings.channelSku, variantId: channelListings.variantId }).from(channelListings).where(and(eq(channelListings.tenantId, tenantId), eq(channelListings.channelId, channelId))),
    db.select({ sku: variants.sku, id: variants.id }).from(variants).where(eq(variants.tenantId, tenantId)),
  ]);
  const byListing = new Map(listings.map((l) => [l.sku.toUpperCase(), l.variantId]));
  const bySku = new Map(vars.map((v) => [v.sku.toUpperCase(), v.id]));
  return (sku: string) => byListing.get(sku.toUpperCase()) ?? bySku.get(sku.toUpperCase()) ?? null;
}

export async function importOrders(c: Ctx, channelCode: ChannelCode, fileName: string, parsed: { orders: ParsedOrder[]; issues: ParseIssue[] }, rowsTotal: number) {
  const ch = await channelByCode(db, c.tenantId, channelCode);
  const resolve = await skuResolver(c.tenantId, ch.id);
  const existing = new Set(
    (await db.select({ id: orders.channelOrderId }).from(orders).where(and(eq(orders.tenantId, c.tenantId), eq(orders.channelId, ch.id)))).map((r) => r.id),
  );
  const fresh = parsed.orders.filter((o) => !existing.has(o.channelOrderId));
  let unmappedSkus = new Set<string>();

  const batch = await db.transaction(async (tx) => {
    const [b] = await tx
      .insert(importBatches)
      .values({
        tenantId: c.tenantId, channelId: ch.id, kind: "ORDERS", fileName, rowsTotal,
        rowsImported: fresh.length, rowsSkipped: parsed.orders.length - fresh.length, errors: parsed.issues.slice(0, 100), createdById: c.userId,
      })
      .returning();
    for (const o of fresh) {
      const [row] = await tx
        .insert(orders)
        .values({
          tenantId: c.tenantId, channelId: ch.id, channelOrderId: o.channelOrderId, customerName: o.customerName, city: o.city, state: o.state,
          status: "NEW", orderedAt: o.orderedAt, dispatchBy: o.dispatchBy, totalPaise: o.totalPaise, importBatchId: b.id,
        })
        .returning({ id: orders.id });
      for (const i of o.items) {
        const variantId = resolve(i.channelSku);
        if (!variantId) unmappedSkus.add(i.channelSku);
        await tx.insert(orderItems).values({ orderId: row.id, variantId, channelSku: i.channelSku, qty: i.qty, pricePaise: i.pricePaise });
      }
    }
    await audit(tx, c, "orders.import", "import_batch", b.id, { channel: channelCode, imported: fresh.length });
    return b;
  });
  return { batch, imported: fresh.length, duplicates: parsed.orders.length - fresh.length, issues: parsed.issues, unmappedSkus: [...unmappedSkus] };
}

export async function importSettlements(c: Ctx, channelCode: ChannelCode, fileName: string, rows: { channelOrderId: string; settledPaise: number; feesPaise: number }[], issues: ParseIssue[]) {
  const ch = await channelByCode(db, c.tenantId, channelCode);
  let matched = 0;
  const notFoundIds: string[] = [];
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const res = await tx
        .update(orders)
        .set({ settledPaise: r.settledPaise, feesPaise: r.feesPaise, settledAt: new Date() })
        .where(and(eq(orders.tenantId, c.tenantId), eq(orders.channelId, ch.id), eq(orders.channelOrderId, r.channelOrderId)));
      if (res.rowsAffected) matched++;
      else notFoundIds.push(r.channelOrderId);
    }
    await tx.insert(importBatches).values({
      tenantId: c.tenantId, channelId: ch.id, kind: "SETTLEMENTS", fileName, rowsTotal: rows.length + issues.length,
      rowsImported: matched, rowsSkipped: notFoundIds.length, errors: issues, createdById: c.userId,
    });
  });
  return { matched, notFound: notFoundIds, issues };
}

/**
 * Reconciliation: for dispatched/delivered orders, compare what the marketplace paid against
 * order value minus fees. Anything more than ₹1 short is flagged.
 */
export async function reconciliation(tenantId: string) {
  const rows = await db
    .select({ o: orders, channelName: channels.name, channelColor: channels.color })
    .from(orders)
    .innerJoin(channels, eq(channels.id, orders.channelId))
    .where(and(eq(orders.tenantId, tenantId), inArray(orders.status, ["DISPATCHED", "DELIVERED"])))
    .orderBy(desc(orders.orderedAt))
    .limit(500);
  const items = rows.map(({ o, channelName, channelColor }) => {
    const expected = o.totalPaise - o.feesPaise;
    const state = o.settledPaise == null ? "PENDING" : o.settledPaise + 100 < expected ? "SHORT" : "MATCHED";
    return { id: o.id, channelOrderId: o.channelOrderId, channelName, channelColor, orderedAt: o.orderedAt, totalPaise: o.totalPaise, feesPaise: o.feesPaise, settledPaise: o.settledPaise, expectedPaise: expected, gapPaise: o.settledPaise == null ? null : expected - o.settledPaise, state };
  });
  const sum = (s: string, k: "totalPaise" | "settledPaise" | "gapPaise") => items.filter((i) => i.state === s).reduce((t, i) => t + (i[k] ?? 0), 0);
  return {
    items,
    summary: {
      matched: items.filter((i) => i.state === "MATCHED").length,
      pending: items.filter((i) => i.state === "PENDING").length,
      short: items.filter((i) => i.state === "SHORT").length,
      pendingPaise: sum("PENDING", "totalPaise"),
      shortPaise: sum("SHORT", "gapPaise"),
      settledPaise: items.reduce((t, i) => t + (i.settledPaise ?? 0), 0),
    },
  };
}

export async function importHistory(tenantId: string) {
  return db
    .select({ b: importBatches, channelName: channels.name, by: users.name })
    .from(importBatches)
    .innerJoin(channels, eq(channels.id, importBatches.channelId))
    .leftJoin(users, eq(users.id, importBatches.createdById))
    .where(eq(importBatches.tenantId, tenantId))
    .orderBy(desc(importBatches.createdAt))
    .limit(30)
    .then((rows) => rows.map((r) => ({ ...r.b, channelName: r.channelName, by: r.by })));
}

/* ------------------------------ Returns ------------------------------ */

/** Good returns go back on the shelf through the ledger; damaged ones are written off. */
export async function createReturn(c: Ctx, input: ReturnInput) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.tenantId, c.tenantId)));
    if (!o) throw notFound("Order");
    if (!["DISPATCHED", "DELIVERED", "RETURNED"].includes(o.status)) throw conflict("Only dispatched orders can be returned");
    const [line] = await tx.select().from(orderItems).where(and(eq(orderItems.orderId, o.id), eq(orderItems.variantId, input.variantId)));
    if (!line) throw badRequest("That SKU is not in this order");
    const [{ already }] = await tx
      .select({ already: sql<number>`coalesce(sum(${returns.qty}), 0)` })
      .from(returns)
      .where(and(eq(returns.orderId, o.id), eq(returns.variantId, input.variantId)));
    if (Number(already) + input.qty > line.qty) throw conflict(`Only ${line.qty - Number(already)} unit(s) left to return on this order`);

    const status = input.condition === "GOOD" ? "RESTOCKED" : "WRITTEN_OFF";
    const [r] = await tx
      .insert(returns)
      .values({ tenantId: c.tenantId, orderId: o.id, variantId: input.variantId, qty: input.qty, type: input.type, condition: input.condition, status, reason: input.reason, createdById: c.userId })
      .returning();
    if (status === "RESTOCKED") {
      await recordMovement(tx, c, { variantId: input.variantId, binId: input.binId, qty: input.qty, type: "RETURN", reason: `${input.type === "RTO" ? "RTO" : "Customer return"} ${o.channelOrderId}`, refType: "return", refId: r.id });
    }
    const [{ totalReturned }] = await tx.select({ totalReturned: sql<number>`sum(${returns.qty})` }).from(returns).where(eq(returns.orderId, o.id));
    const [{ totalOrdered }] = await tx.select({ totalOrdered: sql<number>`sum(${orderItems.qty})` }).from(orderItems).where(eq(orderItems.orderId, o.id));
    if (Number(totalReturned) >= Number(totalOrdered)) await tx.update(orders).set({ status: "RETURNED" }).where(eq(orders.id, o.id));
    await audit(tx, c, "return.create", "return", r.id, { condition: input.condition });
    return r;
  });
}

export async function listReturns(tenantId: string) {
  const rows = await db
    .select({ r: returns, channelOrderId: orders.channelOrderId, channelName: channels.name, channelColor: channels.color, sku: variants.sku, name: products.name, emoji: products.emoji, costPaise: variants.costPaise })
    .from(returns)
    .innerJoin(orders, eq(orders.id, returns.orderId))
    .innerJoin(channels, eq(channels.id, orders.channelId))
    .innerJoin(variants, eq(variants.id, returns.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(returns.tenantId, tenantId))
    .orderBy(desc(returns.createdAt))
    .limit(300);
  const items = rows.map((r) => ({ ...r.r, channelOrderId: r.channelOrderId, channelName: r.channelName, channelColor: r.channelColor, sku: r.sku, name: r.name, emoji: r.emoji, lossPaise: r.r.condition === "DAMAGED" ? r.costPaise * r.r.qty : 0 }));
  return {
    items,
    summary: {
      total: items.length,
      restocked: items.filter((i) => i.status === "RESTOCKED").reduce((s, i) => s + i.qty, 0),
      writtenOff: items.filter((i) => i.status === "WRITTEN_OFF").reduce((s, i) => s + i.qty, 0),
      rto: items.filter((i) => i.type === "RTO").length,
      lossPaise: items.reduce((s, i) => s + i.lossPaise, 0),
    },
  };
}
