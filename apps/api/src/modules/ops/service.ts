import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { allocateTrip, type DateRange } from "@pp/shared";
import { db } from "../../db/client";
import { batchLines, batches, businesses, courierMoves, fundTransfers, investments, locations, losses, platformSales, platforms, products, saleItems, sales, tripItems, trips } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { platformIn, productsIn, requireBusiness } from "../../lib/isolation";
import { recordMovement, unitCost } from "../stock/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;
const num = (v: unknown) => Number(v ?? 0);

/* ───────────── processing batches (painting, packing for wholesale) ───────────── */

export async function createBatch(c: Ctx, i: { businessId: string; date: string; name: string; inputs: { productId: string; qty: number }[]; outputs: { productId: string; qty: number }[]; costs: { kind: string; label?: string; amountPaise: number }[]; note?: string }) {
  await requireBusiness(db, c.tenantId, i.businessId);
  await productsIn(db, c.tenantId, i.businessId, [...i.inputs, ...i.outputs].map((l) => l.productId));
  return db.transaction(async (tx) => {
    const inLines: { productId: string; qty: number; valuePaise: number }[] = [];
    for (const l of i.inputs) inLines.push({ ...l, valuePaise: Math.round(l.qty * (await unitCost(tx, c.tenantId, l.productId))) });
    const inputsPaise = inLines.reduce((s, l) => s + l.valuePaise, 0);
    const costsPaise = i.costs.reduce((s, x) => s + x.amountPaise, 0);
    const total = inputsPaise + costsPaise;
    const split = allocateTrip(i.outputs.map((o) => ({ qty: o.qty, linePaise: 0 })), total, "QTY");
    const [b] = await tx.insert(batches).values({ tenantId: c.tenantId, businessId: i.businessId, name: i.name, date: i.date, inputsPaise, costsPaise, totalPaise: total, costs: i.costs, note: i.note ?? null, createdById: c.userId }).returning();
    for (const l of inLines) {
      await tx.insert(batchLines).values({ batchId: b.id, side: "IN", ...l });
      await recordMovement(tx, c, { productId: l.productId, qty: -l.qty, valuePaise: -l.valuePaise, type: "PROCESS", refType: "batch", refId: b.id, note: `Used in ${i.name}` });
    }
    for (const [n, o] of i.outputs.entries()) {
      await tx.insert(batchLines).values({ batchId: b.id, side: "OUT", productId: o.productId, qty: o.qty, valuePaise: split[n].landedPaise });
      await recordMovement(tx, c, { productId: o.productId, qty: o.qty, valuePaise: split[n].landedPaise, type: "PROCESS", refType: "batch", refId: b.id, note: `Made in ${i.name}` });
    }
    await audit(tx, c, "batch.create", "batch", b.id, { total });
    return b;
  });
}

export async function listBatches(tenantId: string, businessId: string) {
  const [bs, lines] = await Promise.all([
    db.select({ id: batches.id, name: batches.name, date: batches.date, inputsPaise: batches.inputsPaise, costsPaise: batches.costsPaise, totalPaise: batches.totalPaise, costs: batches.costs, business: businesses.name }).from(batches).innerJoin(businesses, eq(businesses.id, batches.businessId)).where(and(eq(batches.tenantId, tenantId), eq(batches.businessId, businessId))).orderBy(desc(batches.date), desc(batches.createdAt)).limit(100),
    db.select({ batchId: batchLines.batchId, side: batchLines.side, qty: batchLines.qty, valuePaise: batchLines.valuePaise, name: products.name, unit: products.unit }).from(batchLines).innerJoin(batches, eq(batches.id, batchLines.batchId)).innerJoin(products, eq(products.id, batchLines.productId)).where(eq(batches.tenantId, tenantId)),
  ]);
  return bs.map((b) => {
    const mine = lines.filter((l) => l.batchId === b.id);
    const out = mine.filter((l) => l.side === "OUT");
    const units = out.reduce((s, l) => s + l.qty, 0);
    return { ...b, inputs: mine.filter((l) => l.side === "IN"), outputs: out, unitCostPaise: units ? Math.round(b.totalPaise / units) : 0 };
  });
}

/* ───────────── courier movement ───────────── */

export async function addCourierMove(c: Ctx, i: { businessId: string; date: string; platformId?: string | null; courier: string; outgoing: number; customerReturn: number; rto: number; time?: string }) {
  await requireBusiness(db, c.tenantId, i.businessId);
  await platformIn(db, c.tenantId, i.businessId, i.platformId);
  const [row] = await db.insert(courierMoves).values({ tenantId: c.tenantId, ...i, platformId: i.platformId ?? null, time: i.time ?? null, createdById: c.userId }).returning();
  return row;
}
export async function listCourierMoves(tenantId: string, r: DateRange, businessId: string) {
  const rows = await db
    .select({ id: courierMoves.id, date: courierMoves.date, courier: courierMoves.courier, outgoing: courierMoves.outgoing, customerReturn: courierMoves.customerReturn, rto: courierMoves.rto, time: courierMoves.time, platform: platforms.name })
    .from(courierMoves).leftJoin(platforms, eq(platforms.id, courierMoves.platformId))
    .where(and(eq(courierMoves.tenantId, tenantId), eq(courierMoves.businessId, businessId), gte(courierMoves.date, r.from), lte(courierMoves.date, r.to)))
    .orderBy(desc(courierMoves.date), desc(courierMoves.createdAt));
  const sum = (k: "outgoing" | "customerReturn" | "rto") => rows.reduce((s, x) => s + x[k], 0);
  return { rows, totals: { outgoing: sum("outgoing"), customerReturn: sum("customerReturn"), rto: sum("rto") } };
}
export async function removeCourierMove(c: Ctx, id: string) {
  const res = await db.delete(courierMoves).where(and(eq(courierMoves.id, id), eq(courierMoves.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Entry");
  return { ok: true };
}

/* ───────────── fund transfers between businesses ───────────── */

export async function addTransfer(c: Ctx, i: { date: string; fromBusinessId: string; toBusinessId: string; amountPaise: number; note?: string }) {
  await requireBusiness(db, c.tenantId, i.fromBusinessId);
  await requireBusiness(db, c.tenantId, i.toBusinessId);
  const [row] = await db.insert(fundTransfers).values({ tenantId: c.tenantId, ...i, note: i.note ?? null, createdById: c.userId }).returning();
  await audit(db, c, "fund.transfer", "fund_transfer", row.id, { amountPaise: i.amountPaise });
  return row;
}
export async function listTransfers(tenantId: string, r: DateRange) {
  return db.select().from(fundTransfers).where(and(eq(fundTransfers.tenantId, tenantId), gte(fundTransfers.date, r.from), lte(fundTransfers.date, r.to))).orderBy(desc(fundTransfers.date), desc(fundTransfers.createdAt));
}

/* ───────────── GST ───────────── */

/** GST inside a price that already includes it. */
const inside = (grossPaise: number, pct: number) => (pct > 0 ? Math.round((grossPaise * pct) / (100 + pct)) : 0);

/** Output GST on what he sold, input GST on what he bought with GST, and what is left to pay (or carry as credit). */
export async function gst(tenantId: string, r: DateRange) {
  const [shop, online, bought] = await Promise.all([
    db.select({ pct: saleItems.gstPct, gross: sql<number>`sum(${saleItems.linePaise})` }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(and(eq(sales.tenantId, tenantId), gte(sales.date, r.from), lte(sales.date, r.to))).groupBy(saleItems.gstPct),
    db.select({ pct: products.gstPct, gross: sql<number>`sum(${platformSales.grossPaise})` }).from(platformSales).innerJoin(products, eq(products.id, platformSales.productId)).where(and(eq(platformSales.tenantId, tenantId), eq(platformSales.status, "DELIVERED"), gte(platformSales.orderDate, r.from), lte(platformSales.orderDate, r.to))).groupBy(products.gstPct),
    db.select({ pct: tripItems.gstPct, gross: sql<number>`sum(${tripItems.linePaise})` }).from(tripItems).innerJoin(trips, eq(trips.id, tripItems.tripId)).where(and(eq(trips.tenantId, tenantId), gte(trips.date, r.from), lte(trips.date, r.to))).groupBy(tripItems.gstPct),
  ]);
  const tax = (rows: { pct: number | null; gross: number }[]) => rows.reduce((s, x) => s + inside(num(x.gross), num(x.pct)), 0);
  const shopGst = tax(shop), onlineGst = tax(online), inputGst = tax(bought);
  const output = shopGst + onlineGst;
  return { range: r, outputPaise: output, outputShopPaise: shopGst, outputOnlinePaise: onlineGst, inputPaise: inputGst, netPaise: output - inputGst };
}

/* ───────────── a place's own account: a fair, a haat, a shop ───────────── */

export async function placeAccounts(tenantId: string, r: DateRange) {
  const [places, s, l, e] = await Promise.all([
    db.select().from(locations).where(eq(locations.tenantId, tenantId)).orderBy(locations.kind, locations.name),
    db.select({ p: sales.locationId, total: sql<number>`sum(${sales.totalPaise})`, cost: sql<number>`sum(${sales.costPaise})`, n: sql<number>`count(*)` }).from(sales).where(and(eq(sales.tenantId, tenantId), gte(sales.date, r.from), lte(sales.date, r.to))).groupBy(sales.locationId),
    db.select({ p: losses.locationId, v: sql<number>`sum(${losses.valuePaise})` }).from(losses).where(and(eq(losses.tenantId, tenantId), gte(losses.date, r.from), lte(losses.date, r.to))).groupBy(losses.locationId),
    db.select({ p: investments.locationId, v: sql<number>`sum(${investments.amountPaise})` }).from(investments).where(and(eq(investments.tenantId, tenantId), gte(investments.date, r.from), lte(investments.date, r.to))).groupBy(investments.locationId),
  ]);
  return places
    .map((p) => {
      const sale = s.find((x) => x.p === p.id);
      const revenue = num(sale?.total), cogs = num(sale?.cost), lossP = num(l.find((x) => x.p === p.id)?.v), exp = num(e.find((x) => x.p === p.id)?.v);
      return { id: p.id, name: p.name, kind: p.kind, sales: num(sale?.n), revenuePaise: revenue, cogsPaise: cogs, lossesPaise: lossP, expensesPaise: exp, profitPaise: revenue - cogs - lossP - exp };
    })
    .filter((p) => p.sales || p.expensesPaise || p.lossesPaise);
}
