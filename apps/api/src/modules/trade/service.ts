import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { monthsBetween, type DateRange, type SaleInput } from "@pp/shared";
import { db, type Executor } from "../../db/client";
import { businesses, fundTransfers, investments, locations, losses, parties, partyEntries, platformSales, products, saleItems, saleReturns, sales, stockMovements } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, conflict, isUniqueViolation, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { assertBusiness } from "../business/service";
import { payroll } from "../hr/service";
import { recordMovement, unitCost } from "../stock/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;
const num = (v: unknown) => Number(v ?? 0);

async function assertLocation(ex: Executor, tenantId: string, id?: string | null) {
  if (!id) return;
  const [l] = await ex.select({ id: locations.id }).from(locations).where(and(eq(locations.id, id), eq(locations.tenantId, tenantId)));
  if (!l) throw badRequest("Unknown place");
}
async function assertProducts(ex: Executor, tenantId: string, ids: string[]) {
  for (const id of new Set(ids)) {
    const [p] = await ex.select({ id: products.id }).from(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
    if (!p) throw notFound("Product");
  }
}
async function assertParty(ex: Executor, tenantId: string, id?: string | null) {
  if (!id) return null;
  const [p] = await ex.select().from(parties).where(and(eq(parties.id, id), eq(parties.tenantId, tenantId)));
  if (!p) throw badRequest("Unknown customer or supplier");
  return p;
}

/* ───────────── sales ───────────── */

export async function createSale(c: Ctx, input: SaleInput) {
  await assertBusiness(c.tenantId, input.businessId);
  await assertLocation(db, c.tenantId, input.locationId);
  await assertParty(db, c.tenantId, input.customerId);
  await assertProducts(db, c.tenantId, input.items.map((i) => i.productId));
  return db.transaction(async (tx) => {
    const lines: { productId: string; qty: number; unitPricePaise: number; linePaise: number; costPaise: number; gstPct: number }[] = [];
    for (const it of input.items) {
      const cost = Math.round(it.qty * (await unitCost(tx, c.tenantId, it.productId)));
      const [pr] = await tx.select({ g: products.gstPct }).from(products).where(eq(products.id, it.productId));
      lines.push({ ...it, linePaise: Math.round(it.qty * it.unitPricePaise), costPaise: cost, gstPct: pr?.g ?? 0 });
    }
    const total = lines.length ? lines.reduce((s, l) => s + l.linePaise, 0) : input.totalPaise ?? 0;
    const paid = input.paidPaise ?? total;
    if (paid > total) throw badRequest("Received money is more than the bill total");
    if (paid < total && !input.customerId) throw badRequest("Choose the customer so the unpaid amount is kept as a due");
    const cost = lines.reduce((s, l) => s + l.costPaise, 0);
    const [sale] = await tx.insert(sales).values({ tenantId: c.tenantId, businessId: input.businessId, locationId: input.locationId ?? null, channel: input.channel, date: input.date, customerId: input.customerId ?? null, totalPaise: total, paidPaise: paid, costPaise: cost, note: input.note ?? null, createdById: c.userId }).returning();
    for (const l of lines) {
      await tx.insert(saleItems).values({ saleId: sale.id, ...l });
      await recordMovement(tx, c, { productId: l.productId, qty: -l.qty, valuePaise: -l.costPaise, type: "SALE", refType: "sale", refId: sale.id, locationId: input.locationId ?? null });
    }
    if (total > paid) await tx.insert(partyEntries).values({ tenantId: c.tenantId, partyId: input.customerId!, kind: "BILL", amountPaise: total - paid, date: input.date, businessId: input.businessId, refType: "sale", refId: sale.id, note: "Unpaid part of a sale", createdById: c.userId });
    await audit(tx, c, "sale.create", "sale", sale.id, { total, items: lines.length });
    return { ...sale, dueRaisedPaise: total - paid };
  });
}

export async function listSales(tenantId: string, q: { from?: string; to?: string; businessId?: string; limit?: number }) {
  const where = [eq(sales.tenantId, tenantId)];
  if (q.from) where.push(gte(sales.date, q.from));
  if (q.to) where.push(lte(sales.date, q.to));
  if (q.businessId) where.push(eq(sales.businessId, q.businessId));
  const rows = await db
    .select({ id: sales.id, date: sales.date, channel: sales.channel, totalPaise: sales.totalPaise, paidPaise: sales.paidPaise, costPaise: sales.costPaise, note: sales.note, businessId: sales.businessId, business: businesses.name, place: locations.name, customer: parties.name, createdAt: sales.createdAt })
    .from(sales)
    .innerJoin(businesses, eq(businesses.id, sales.businessId))
    .leftJoin(locations, eq(locations.id, sales.locationId))
    .leftJoin(parties, eq(parties.id, sales.customerId))
    .where(and(...where))
    .orderBy(desc(sales.date), desc(sales.createdAt))
    .limit(Math.min(q.limit ?? 100, 500));
  return rows;
}

export async function removeSale(c: Ctx, id: string) {
  const [s] = await db.select().from(sales).where(and(eq(sales.id, id), eq(sales.tenantId, c.tenantId)));
  if (!s) throw notFound("Sale");
  await db.transaction(async (tx) => {
    await tx.delete(stockMovements).where(and(eq(stockMovements.refType, "sale"), eq(stockMovements.refId, id)));
    await tx.delete(partyEntries).where(and(eq(partyEntries.refType, "sale"), eq(partyEntries.refId, id)));
    await tx.delete(saleItems).where(eq(saleItems.saleId, id));
    await tx.delete(sales).where(eq(sales.id, id));
    await audit(tx, c, "sale.delete", "sale", id, { total: s.totalPaise });
  });
  return { ok: true };
}

/* ───────────── returns, losses, transfers ───────────── */

export async function createReturn(c: Ctx, i: { businessId: string; locationId?: string | null; productId: string; qty: number; date: string; condition: "GOOD" | "DAMAGED"; refundPaise: number; note?: string }) {
  await assertBusiness(c.tenantId, i.businessId);
  await assertLocation(db, c.tenantId, i.locationId);
  await assertProducts(db, c.tenantId, [i.productId]);
  return db.transaction(async (tx) => {
    const cost = Math.round(i.qty * (await unitCost(tx, c.tenantId, i.productId)));
    const [r] = await tx.insert(saleReturns).values({ tenantId: c.tenantId, businessId: i.businessId, locationId: i.locationId ?? null, productId: i.productId, qty: i.qty, date: i.date, condition: i.condition, refundPaise: i.refundPaise, costPaise: cost, note: i.note ?? null, createdById: c.userId }).returning();
    if (i.condition === "GOOD") {
      await recordMovement(tx, c, { productId: i.productId, qty: i.qty, valuePaise: cost, type: "RETURN", refType: "return", refId: r.id, locationId: i.locationId ?? null });
    } else {
      // Damaged goods never go back on the shelf; their cost is written off.
      await tx.insert(losses).values({ tenantId: c.tenantId, businessId: i.businessId, locationId: i.locationId ?? null, productId: i.productId, qty: i.qty, valuePaise: cost, date: i.date, reason: "DAMAGED_RETURN", note: i.note ?? null, createdById: c.userId });
    }
    await audit(tx, c, "return.create", "sale_return", r.id, { condition: i.condition });
    return r;
  });
}

export async function createLoss(c: Ctx, i: { businessId?: string | null; locationId?: string | null; productId: string; qty: number; date: string; reason: "DAMAGED_RETURN" | "WASTE" | "SPOILAGE" | "OTHER"; note?: string }) {
  await assertBusiness(c.tenantId, i.businessId);
  await assertLocation(db, c.tenantId, i.locationId);
  await assertProducts(db, c.tenantId, [i.productId]);
  return db.transaction(async (tx) => {
    const value = Math.round(i.qty * (await unitCost(tx, c.tenantId, i.productId)));
    const [l] = await tx.insert(losses).values({ tenantId: c.tenantId, businessId: i.businessId ?? null, locationId: i.locationId ?? null, productId: i.productId, qty: i.qty, valuePaise: value, date: i.date, reason: i.reason, note: i.note ?? null, createdById: c.userId }).returning();
    await recordMovement(tx, c, { productId: i.productId, qty: -i.qty, valuePaise: -value, type: "LOSS", refType: "loss", refId: l.id, locationId: i.locationId ?? null });
    await audit(tx, c, "loss.create", "loss", l.id, { reason: i.reason, value });
    return l;
  });
}

export async function listLossesAndReturns(tenantId: string, q: { from?: string; to?: string; businessId?: string }) {
  const lw = [eq(losses.tenantId, tenantId)], rw = [eq(saleReturns.tenantId, tenantId)];
  if (q.businessId) { lw.push(eq(losses.businessId, q.businessId)); rw.push(eq(saleReturns.businessId, q.businessId)); }
  if (q.from) { lw.push(gte(losses.date, q.from)); rw.push(gte(saleReturns.date, q.from)); }
  if (q.to) { lw.push(lte(losses.date, q.to)); rw.push(lte(saleReturns.date, q.to)); }
  const [l, r] = await Promise.all([
    db.select({ id: losses.id, date: losses.date, reason: losses.reason, qty: losses.qty, valuePaise: losses.valuePaise, note: losses.note, product: products.name, business: businesses.name }).from(losses).leftJoin(products, eq(products.id, losses.productId)).leftJoin(businesses, eq(businesses.id, losses.businessId)).where(and(...lw)).orderBy(desc(losses.date), desc(losses.createdAt)).limit(200),
    db.select({ id: saleReturns.id, date: saleReturns.date, condition: saleReturns.condition, qty: saleReturns.qty, refundPaise: saleReturns.refundPaise, product: products.name, business: businesses.name }).from(saleReturns).innerJoin(products, eq(products.id, saleReturns.productId)).innerJoin(businesses, eq(businesses.id, saleReturns.businessId)).where(and(...rw)).orderBy(desc(saleReturns.date), desc(saleReturns.createdAt)).limit(200),
  ]);
  const totalLossPaise = l.reduce((s, x) => s + x.valuePaise, 0);
  return { losses: l, returns: r, totalLossPaise };
}

export async function transfer(c: Ctx, i: { productId: string; qty: number; fromLocationId: string | null; toLocationId: string; note?: string }) {
  await assertLocation(db, c.tenantId, i.fromLocationId);
  await assertLocation(db, c.tenantId, i.toLocationId);
  await assertProducts(db, c.tenantId, [i.productId]);
  return db.transaction(async (tx) => {
    const value = Math.round(i.qty * (await unitCost(tx, c.tenantId, i.productId)));
    const ref = crypto.randomUUID();
    await recordMovement(tx, c, { productId: i.productId, qty: -i.qty, valuePaise: -value, type: "TRANSFER", refType: "transfer", refId: ref, note: i.note, locationId: i.fromLocationId });
    await recordMovement(tx, c, { productId: i.productId, qty: i.qty, valuePaise: value, type: "TRANSFER", refType: "transfer", refId: ref, note: i.note, locationId: i.toLocationId });
    await audit(tx, c, "stock.transfer", "stock", ref, { qty: i.qty });
    return { ok: true, ref };
  });
}

/** What is where: every product's quantity in each place ("Main stock" = not placed anywhere yet). */
export async function stockByPlace(tenantId: string) {
  const rows = await db
    .select({ productId: stockMovements.productId, name: products.name, unit: products.unit, locationId: stockMovements.locationId, qty: sql<number>`sum(${stockMovements.qty})`, value: sql<number>`sum(${stockMovements.valuePaise})` })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .where(eq(stockMovements.tenantId, tenantId))
    .groupBy(stockMovements.productId, stockMovements.locationId);
  return rows.filter((r) => Math.abs(num(r.qty)) > 1e-9).map((r) => ({ productId: r.productId, name: r.name, unit: r.unit, locationId: r.locationId, qty: Math.round(num(r.qty) * 1000) / 1000, valuePaise: num(r.value) }));
}

/* ───────────── dues ───────────── */

export async function createParty(c: Ctx, i: { name: string; kind: "CUSTOMER" | "SUPPLIER"; phone?: string; note?: string }) {
  try {
    const [p] = await db.insert(parties).values({ tenantId: c.tenantId, ...i, phone: i.phone ?? null, note: i.note ?? null }).returning();
    await audit(db, c, "party.create", "party", p.id, { name: p.name });
    return p;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict(`${i.name} is already added`);
    throw e;
  }
}

export async function listParties(tenantId: string) {
  const [ps, es] = await Promise.all([
    db.select().from(parties).where(eq(parties.tenantId, tenantId)).orderBy(parties.name),
    db.select({ partyId: partyEntries.partyId, kind: partyEntries.kind, amount: sql<number>`sum(${partyEntries.amountPaise})` }).from(partyEntries).where(eq(partyEntries.tenantId, tenantId)).groupBy(partyEntries.partyId, partyEntries.kind),
  ]);
  return ps.map((p) => {
    const mine = es.filter((e) => e.partyId === p.id);
    const sum = (k: string) => num(mine.find((e) => e.kind === k)?.amount);
    return { ...p, billedPaise: sum("BILL"), paidPaise: sum("PAYMENT"), advancePaise: sum("ADVANCE"), duePaise: sum("BILL") - sum("PAYMENT") - sum("ADVANCE") };
  });
}

export async function addEntry(c: Ctx, i: { partyId: string; kind: "BILL" | "PAYMENT" | "ADVANCE"; amountPaise: number; date: string; businessId?: string | null; note?: string }) {
  await assertParty(db, c.tenantId, i.partyId);
  await assertBusiness(c.tenantId, i.businessId);
  const [e] = await db.insert(partyEntries).values({ tenantId: c.tenantId, ...i, businessId: i.businessId ?? null, note: i.note ?? null, createdById: c.userId }).returning();
  await audit(db, c, "party.entry", "party_entry", e.id, { kind: i.kind, amountPaise: i.amountPaise });
  return e;
}

export async function partyEntriesFor(tenantId: string, partyId: string) {
  await assertParty(db, tenantId, partyId);
  return db.select().from(partyEntries).where(and(eq(partyEntries.tenantId, tenantId), eq(partyEntries.partyId, partyId))).orderBy(desc(partyEntries.date), desc(partyEntries.createdAt));
}

/* ───────────── accounts: profit per business and combined ───────────── */

/**
 * Salaries as an expense of the business each person works for. A month's payable salary is spread evenly over its days,
 * so any date range picks up exactly the share that falls inside it. Only people still active are counted.
 */
async function salaryByBusiness(tenantId: string, r: DateRange) {
  const out = new Map<string | null, number>();
  for (const month of monthsBetween(r.from.slice(0, 7), r.to.slice(0, 7))) {
    const [y, m] = month.split("-").map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const a = r.from > `${month}-01` ? r.from : `${month}-01`;
    const b = r.to < `${month}-${String(days).padStart(2, "0")}` ? r.to : `${month}-${String(days).padStart(2, "0")}`;
    const overlap = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
    if (overlap <= 0) continue;
    const sheet = await payroll(tenantId, month);
    for (const row of sheet.rows) {
      const k = row.employee.businessId ?? null;
      out.set(k, (out.get(k) ?? 0) + Math.round((row.payablePaise * overlap) / days));
    }
  }
  return out;
}

export async function accounts(tenantId: string, r: DateRange) {
  const biz = await db.select().from(businesses).where(eq(businesses.tenantId, tenantId)).orderBy(businesses.createdAt);
  const between = <T extends { date: unknown }>(col: T["date"]) => [gte(col as never, r.from), lte(col as never, r.to)];
  const salaries = await salaryByBusiness(tenantId, r);
  const [s, rt, ls, ex, pm, ft] = await Promise.all([
    db.select({ b: sales.businessId, total: sql<number>`sum(${sales.totalPaise})`, cost: sql<number>`sum(${sales.costPaise})`, n: sql<number>`count(*)` }).from(sales).where(and(eq(sales.tenantId, tenantId), ...between(sales.date))).groupBy(sales.businessId),
    db.select({ b: saleReturns.businessId, refund: sql<number>`sum(${saleReturns.refundPaise})`, goodCost: sql<number>`sum(case when ${saleReturns.condition} = 'GOOD' then ${saleReturns.costPaise} else 0 end)` }).from(saleReturns).where(and(eq(saleReturns.tenantId, tenantId), ...between(saleReturns.date))).groupBy(saleReturns.businessId),
    db.select({ b: losses.businessId, v: sql<number>`sum(${losses.valuePaise})` }).from(losses).where(and(eq(losses.tenantId, tenantId), ...between(losses.date))).groupBy(losses.businessId),
    db.select({ b: investments.businessId, v: sql<number>`sum(${investments.amountPaise})` }).from(investments).where(and(eq(investments.tenantId, tenantId), ...between(investments.date))).groupBy(investments.businessId),
    db.select({ net: sql<number>`coalesce(sum(${platformSales.netPaise}), 0)`, cost: sql<number>`coalesce(sum(${platformSales.costPaise}), 0)`, orders: sql<number>`count(*)` }).from(platformSales).where(and(eq(platformSales.tenantId, tenantId), eq(platformSales.status, "DELIVERED"), gte(platformSales.orderDate, r.from), lte(platformSales.orderDate, r.to))),
    db.select({ from: fundTransfers.fromBusinessId, to: fundTransfers.toBusinessId, v: fundTransfers.amountPaise }).from(fundTransfers).where(and(eq(fundTransfers.tenantId, tenantId), gte(fundTransfers.date, r.from), lte(fundTransfers.date, r.to))),
  ]);
  const online = biz.find((b) => b.kind === "ONLINE")?.id ?? null;
  const rowFor = (id: string | null) => {
    const pick = <T extends { b: string | null }>(a: T[]) => a.find((x) => x.b === id);
    const sale = pick(s), ret = pick(rt);
    const onl = id !== null && id === online ? pm[0] : undefined;
    const revenue = num(sale?.total) + num(onl?.net);
    const refunds = num(ret?.refund);
    const cogs = num(sale?.cost) + num(onl?.cost) - num(ret?.goodCost);
    const lossesPaise = num(pick(ls)?.v), expenses = num(pick(ex)?.v);
    const salariesPaise = salaries.get(id) ?? 0;
    const profit = revenue - refunds - cogs - lossesPaise - expenses - salariesPaise;
    const fundNet = ft.filter((x) => x.to === id).reduce((a, x) => a + x.v, 0) - ft.filter((x) => x.from === id).reduce((a, x) => a + x.v, 0);
    return { fundNetPaise: id === null ? 0 : fundNet, revenuePaise: revenue, refundsPaise: refunds, cogsPaise: cogs, lossesPaise, expensesPaise: expenses, salariesPaise, profitPaise: profit, marginPct: revenue ? Math.round((profit / revenue) * 1000) / 10 : 0, sales: num(sale?.n) + num(onl?.orders) };
  };
  const list = [...biz.map((b) => ({ id: b.id, name: b.name, kind: b.kind, color: b.color, ...rowFor(b.id) })), { id: null, name: "Not assigned to a business", kind: "NONE", color: "#6B7280", ...rowFor(null) }].filter((x) => x.id !== null || x.revenuePaise || x.lossesPaise || x.expensesPaise || x.refundsPaise || x.cogsPaise || x.salariesPaise);
  const sum = (k: "revenuePaise" | "refundsPaise" | "cogsPaise" | "lossesPaise" | "expensesPaise" | "salariesPaise" | "profitPaise") => list.reduce((a, x) => a + x[k], 0);
  const total = { revenuePaise: sum("revenuePaise"), refundsPaise: sum("refundsPaise"), cogsPaise: sum("cogsPaise"), lossesPaise: sum("lossesPaise"), expensesPaise: sum("expensesPaise"), salariesPaise: sum("salariesPaise"), profitPaise: sum("profitPaise") };
  return { range: r, businesses: list, total: { ...total, marginPct: total.revenuePaise ? Math.round((total.profitPaise / total.revenuePaise) * 1000) / 10 : 0 } };
}
