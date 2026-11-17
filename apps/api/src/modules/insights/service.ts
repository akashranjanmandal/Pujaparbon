import { and, desc, eq, gte, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import { istDateKey } from "@pp/shared";
import { db } from "../../db/client";
import {
  auditLogs, channels, employees, expenses, invoices, leaves, orderItems, orders, payslips, products, returns,
  stockMovements, suppliers, users, variants,
} from "../../db/schema";
import { list as stockList } from "../stock/service";
import { todayBoard } from "../hr/service";

const DAY = 86_400_000;
/** SQLite expression: IST calendar day of a millisecond timestamp column. */
const istDay = (col: unknown) => sql<string>`strftime('%Y-%m-%d', ${col} / 1000, 'unixepoch', '+330 minutes')`;
const istMonth = (col: unknown) => sql<string>`strftime('%Y-%m', ${col} / 1000, 'unixepoch', '+330 minutes')`;
const LIVE = ["NEW", "PICKED", "PACKED", "DISPATCHED", "DELIVERED"] as const;

const pctChange = (now: number, before: number) => (before === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / before) * 1000) / 10);

async function revenueBetween(tenantId: string, from: Date, to: Date) {
  const [o] = await db
    .select({ paise: sql<number>`coalesce(sum(${orders.totalPaise}), 0)`, n: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), inArray(orders.status, [...LIVE, "RETURNED"]), gte(orders.orderedAt, from), lt(orders.orderedAt, to)));
  const [i] = await db
    .select({ paise: sql<number>`coalesce(sum(${invoices.totalPaise}), 0)`, n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, "ISSUED"), gte(invoices.createdAt, from), lt(invoices.createdAt, to)));
  return { paise: Number(o.paise) + Number(i.paise), orders: Number(o.n) + Number(i.n) };
}

export async function dashboard(tenantId: string, now = new Date()) {
  const todayStart = new Date(`${istDateKey(now)}T00:00:00+05:30`);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);

  const [today, yesterday, last30, prev30, stock, team, statusRows, trendRows, channelRows, topRows, overdueRows, recent, returns30] = await Promise.all([
    revenueBetween(tenantId, todayStart, now),
    revenueBetween(tenantId, new Date(todayStart.getTime() - DAY), todayStart),
    revenueBetween(tenantId, d30, now),
    revenueBetween(tenantId, d60, d30),
    stockList(tenantId, {}),
    todayBoard(tenantId, now),
    db.select({ status: orders.status, n: sql<number>`count(*)` }).from(orders).where(eq(orders.tenantId, tenantId)).groupBy(orders.status),
    db
      .select({ day: istDay(orders.orderedAt), code: channels.code, paise: sql<number>`sum(${orders.totalPaise})`, n: sql<number>`count(*)` })
      .from(orders)
      .innerJoin(channels, eq(channels.id, orders.channelId))
      .where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, d30), inArray(orders.status, [...LIVE, "RETURNED"])))
      .groupBy(istDay(orders.orderedAt), channels.code),
    db
      .select({ code: channels.code, name: channels.name, color: channels.color, paise: sql<number>`coalesce(sum(${orders.totalPaise}), 0)`, n: sql<number>`count(${orders.id})` })
      .from(channels)
      .leftJoin(orders, and(eq(orders.channelId, channels.id), gte(orders.orderedAt, d30), inArray(orders.status, [...LIVE, "RETURNED"])))
      .where(eq(channels.tenantId, tenantId))
      .groupBy(channels.id),
    db
      .select({ sku: variants.sku, name: products.name, size: variants.size, color: variants.color, units: sql<number>`sum(${orderItems.qty})`, paise: sql<number>`sum(${orderItems.qty} * ${orderItems.pricePaise})` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(variants, eq(variants.id, orderItems.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, d30), inArray(orders.status, [...LIVE])))
      .groupBy(variants.id)
      .orderBy(desc(sql`sum(${orderItems.qty} * ${orderItems.pricePaise})`))
      .limit(5),
    db
      .select({ id: orders.id, channelOrderId: orders.channelOrderId, dispatchBy: orders.dispatchBy, status: orders.status, channelName: channels.name, channelColor: channels.color })
      .from(orders)
      .innerJoin(channels, eq(channels.id, orders.channelId))
      .where(and(eq(orders.tenantId, tenantId), inArray(orders.status, ["NEW", "PICKED", "PACKED"]), lt(orders.dispatchBy, now)))
      .orderBy(orders.dispatchBy)
      .limit(6),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, meta: auditLogs.meta, createdAt: auditLogs.createdAt, by: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
    db.select({ n: sql<number>`count(*)` }).from(returns).where(and(eq(returns.tenantId, tenantId), gte(returns.createdAt, d30))),
  ]);

  const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)]));
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(istDateKey(new Date(now.getTime() - i * DAY)));
  const codes = [...new Set(trendRows.map((r) => r.code))];
  const trend = days.map((day) => {
    const row: Record<string, number | string> = { day, total: 0, orders: 0 };
    for (const c of codes) row[c] = 0;
    for (const r of trendRows.filter((x) => x.day === day)) {
      row[r.code] = Number(r.paise);
      row.total = Number(row.total) + Number(r.paise);
      row.orders = Number(row.orders) + Number(r.n);
    }
    return row;
  });

  const pendingDispatch = (statusCounts.NEW ?? 0) + (statusCounts.PICKED ?? 0) + (statusCounts.PACKED ?? 0);
  return {
    kpis: {
      todayRevenuePaise: today.paise,
      todayOrders: today.orders,
      todayChangePct: pctChange(today.paise, yesterday.paise),
      revenue30Paise: last30.paise,
      orders30: last30.orders,
      revenue30ChangePct: pctChange(last30.paise, prev30.paise),
      avgOrderPaise: last30.orders ? Math.round(last30.paise / last30.orders) : 0,
      stockValuePaise: stock.totals.valueAtCostPaise,
      units: stock.totals.units,
      skus: stock.totals.skus,
      lowStock: stock.totals.low,
      outOfStock: stock.totals.out,
      pendingDispatch,
      overdueDispatch: overdueRows.length,
      returns30: Number(returns30[0]?.n ?? 0),
      present: team.summary.present + team.summary.late,
      late: team.summary.late,
      teamSize: team.summary.total,
    },
    trend,
    channelCodes: codes,
    channelMix: channelRows.map((r) => ({ ...r, paise: Number(r.paise), n: Number(r.n) })).filter((r) => r.n > 0).sort((a, b) => b.paise - a.paise),
    pipeline: ["NEW", "PICKED", "PACKED", "DISPATCHED", "DELIVERED"].map((s) => ({ status: s, n: statusCounts[s] ?? 0 })),
    topSkus: topRows.map((r) => ({ ...r, units: Number(r.units), paise: Number(r.paise) })),
    lowStock: stock.items.filter((i) => i.state !== "OK").sort((a, b) => a.onHand - b.onHand).slice(0, 6),
    overdue: overdueRows,
    team: team.items.slice(0, 12),
    teamSummary: team.summary,
    recent,
  };
}

export async function analytics(tenantId: string, now = new Date()) {
  const since = new Date(now.getTime() - 180 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);

  const [revRows, invRows, feeRows, cogsRows, retRows, expRows, payRows, skuRows, stock, lastSale, stateRows, heatRows] = await Promise.all([
    db.select({ m: istMonth(orders.orderedAt), paise: sql<number>`sum(${orders.totalPaise})` }).from(orders)
      .where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, since), inArray(orders.status, [...LIVE, "RETURNED"]))).groupBy(istMonth(orders.orderedAt)),
    db.select({ m: sql<string>`substr(${invoices.date}, 1, 7)`, paise: sql<number>`sum(${invoices.totalPaise})` }).from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, "ISSUED"), gte(invoices.createdAt, since))).groupBy(sql`substr(${invoices.date}, 1, 7)`),
    db.select({ m: istMonth(orders.orderedAt), paise: sql<number>`sum(${orders.feesPaise})` }).from(orders)
      .where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, since))).groupBy(istMonth(orders.orderedAt)),
    db.select({ m: istMonth(stockMovements.createdAt), paise: sql<number>`sum(-${stockMovements.qty} * ${variants.costPaise})` }).from(stockMovements)
      .innerJoin(variants, eq(variants.id, stockMovements.variantId))
      .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.type, "SALE"), gte(stockMovements.createdAt, since))).groupBy(istMonth(stockMovements.createdAt)),
    db.select({ m: istMonth(returns.createdAt), paise: sql<number>`sum(${returns.qty} * (select price_paise from order_items i where i.order_id = ${returns.orderId} and i.variant_id = ${returns.variantId} limit 1))` }).from(returns)
      .where(and(eq(returns.tenantId, tenantId), gte(returns.createdAt, since))).groupBy(istMonth(returns.createdAt)),
    db.select({ m: sql<string>`substr(${expenses.date}, 1, 7)`, paise: sql<number>`sum(${expenses.amountPaise})` }).from(expenses)
      .where(eq(expenses.tenantId, tenantId)).groupBy(sql`substr(${expenses.date}, 1, 7)`),
    db.select({ m: payslips.month, paise: sql<number>`sum(${payslips.netPaise})` }).from(payslips).where(eq(payslips.tenantId, tenantId)).groupBy(payslips.month),
    db.select({
      variantId: variants.id, sku: variants.sku, name: products.name, emoji: products.emoji, costPaise: variants.costPaise,
      units: sql<number>`sum(${orderItems.qty})`, paise: sql<number>`sum(${orderItems.qty} * ${orderItems.pricePaise})`,
    }).from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(variants, eq(variants.id, orderItems.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, d30), inArray(orders.status, [...LIVE])))
      .groupBy(variants.id),
    stockList(tenantId, {}),
    db.select({ variantId: stockMovements.variantId, last: sql<number>`max(${stockMovements.createdAt})` }).from(stockMovements)
      .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.type, "SALE"))).groupBy(stockMovements.variantId),
    db.select({ state: orders.state, paise: sql<number>`sum(${orders.totalPaise})`, n: sql<number>`count(*)` }).from(orders)
      .where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, since), inArray(orders.status, [...LIVE]))).groupBy(orders.state),
    db.select({
      dow: sql<number>`cast(strftime('%w', ${orders.orderedAt} / 1000, 'unixepoch', '+330 minutes') as integer)`,
      hour: sql<number>`cast(strftime('%H', ${orders.orderedAt} / 1000, 'unixepoch', '+330 minutes') as integer)`,
      n: sql<number>`count(*)`,
    }).from(orders).where(and(eq(orders.tenantId, tenantId), gte(orders.orderedAt, d60))).groupBy(sql`1`, sql`2`),
  ]);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const pick = (rows: { m: string; paise: number }[], m: string) => Number(rows.find((r) => r.m === m)?.paise ?? 0);
  const pnl = months.map((m) => {
    const revenue = pick(revRows, m) + pick(invRows, m);
    const returnsPaise = pick(retRows, m);
    const fees = pick(feeRows, m);
    const cogs = pick(cogsRows, m);
    const expensesPaise = pick(expRows, m);
    const payroll = pick(payRows, m);
    const gross = revenue - returnsPaise - fees - cogs;
    return { month: m, revenue, returns: returnsPaise, fees, cogs, expenses: expensesPaise, payroll, grossProfit: gross, netProfit: gross - expensesPaise - payroll };
  });

  const skuPerformance = skuRows
    .map((r) => {
      const units = Number(r.units), paise = Number(r.paise);
      const margin = paise - units * r.costPaise;
      return { ...r, units, paise, marginPaise: margin, marginPct: paise ? Math.round((margin / paise) * 1000) / 10 : 0 };
    })
    .sort((a, b) => b.paise - a.paise);

  const sold30 = new Map(skuPerformance.map((s) => [s.variantId, s.units]));
  const lastSaleMap = new Map(lastSale.map((r) => [r.variantId, Number(r.last)]));
  const deadStock = stock.items
    .filter((i) => i.onHand > 0 && (lastSaleMap.get(i.variantId) ?? 0) < d60.getTime())
    .map((i) => ({ ...i, lastSaleAt: lastSaleMap.get(i.variantId) ?? null, valuePaise: i.onHand * i.costPaise }))
    .sort((a, b) => b.valuePaise - a.valuePaise)
    .slice(0, 12);

  /** Reorder when stock covers less than 14 days at the last-30-day sales rate; suggest 30 days of cover. */
  const reorder = stock.items
    .map((i) => {
      const perDay = (sold30.get(i.variantId) ?? 0) / 30;
      const cover = perDay > 0 ? Math.floor(i.available / perDay) : null;
      const suggestQty = perDay > 0 ? Math.max(0, Math.ceil(perDay * 30) - i.available) : 0;
      return { ...i, perDay: Math.round(perDay * 10) / 10, coverDays: cover, suggestQty };
    })
    .filter((i) => i.coverDays !== null && i.coverDays < 14 && i.suggestQty > 0)
    .sort((a, b) => (a.coverDays ?? 0) - (b.coverDays ?? 0))
    .slice(0, 12);

  const heat = Array.from({ length: 7 }, (_, dow) => Array.from({ length: 24 }, (_, hour) => Number(heatRows.find((h) => Number(h.dow) === dow && Number(h.hour) === hour)?.n ?? 0)));

  return {
    pnl,
    skuPerformance: skuPerformance.slice(0, 15),
    deadStock,
    reorder,
    states: stateRows.filter((s) => s.state).map((s) => ({ state: s.state!, paise: Number(s.paise), n: Number(s.n) })).sort((a, b) => b.paise - a.paise),
    heat,
  };
}

export async function search(tenantId: string, q: string) {
  const s = `%${q}%`;
  const [prods, ords, emps, sups] = await Promise.all([
    db.select({ id: products.id, name: products.name, emoji: products.emoji, sku: variants.sku }).from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(and(eq(variants.tenantId, tenantId), isNull(products.deletedAt), or(like(products.name, s), like(variants.sku, s)))).limit(6),
    db.select({ id: orders.id, channelOrderId: orders.channelOrderId, customerName: orders.customerName, status: orders.status }).from(orders)
      .where(and(eq(orders.tenantId, tenantId), or(like(orders.channelOrderId, s), like(orders.customerName, s)))).limit(6),
    db.select({ id: employees.id, name: employees.name, designation: employees.designation }).from(employees)
      .where(and(eq(employees.tenantId, tenantId), or(like(employees.name, s), like(employees.code, s)))).limit(5),
    db.select({ id: suppliers.id, name: suppliers.name, city: suppliers.city }).from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), like(suppliers.name, s))).limit(4),
  ]);
  return { products: prods, orders: ords, employees: emps, suppliers: sups };
}

/** Alerts computed live: nothing to keep in sync. */
export async function notifications(tenantId: string, role: string, now = new Date()) {
  const out: { id: string; level: "critical" | "warning" | "info"; title: string; body: string; href: string }[] = [];
  const stock = await stockList(tenantId, { filter: "low" });
  const out0 = stock.items.filter((i) => i.state === "OUT");
  if (out0.length) out.push({ id: "out", level: "critical", title: `${out0.length} SKU${out0.length > 1 ? "s" : ""} out of stock`, body: out0.slice(0, 3).map((i) => i.sku).join(", "), href: "/stock?filter=out" });
  const low = stock.items.filter((i) => i.state === "LOW");
  if (low.length) out.push({ id: "low", level: "warning", title: `${low.length} SKU${low.length > 1 ? "s" : ""} running low`, body: low.slice(0, 3).map((i) => `${i.sku} (${i.onHand})`).join(", "), href: "/stock?filter=low" });
  const [overdue] = await db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.tenantId, tenantId), inArray(orders.status, ["NEW", "PICKED", "PACKED"]), lt(orders.dispatchBy, now)));
  if (Number(overdue.n)) out.push({ id: "overdue", level: "critical", title: `${overdue.n} order${Number(overdue.n) > 1 ? "s" : ""} past dispatch time`, body: "Marketplaces penalise late dispatch. Clear these first.", href: "/orders?status=NEW,PICKED,PACKED" });
  const [unmapped] = await db.select({ n: sql<number>`count(distinct ${orderItems.channelSku})` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(eq(orders.tenantId, tenantId), isNull(orderItems.variantId)));
  if (Number(unmapped.n)) out.push({ id: "unmapped", level: "warning", title: `${unmapped.n} marketplace SKU${Number(unmapped.n) > 1 ? "s" : ""} not mapped`, body: "Map them to products so dispatch can deduct stock.", href: "/orders?status=NEW" });
  if (role !== "STAFF") {
    const [pending] = await db.select({ n: sql<number>`count(*)` }).from(leaves).where(and(eq(leaves.tenantId, tenantId), eq(leaves.status, "PENDING")));
    if (Number(pending.n)) out.push({ id: "leave", level: "info", title: `${pending.n} leave request${Number(pending.n) > 1 ? "s" : ""} waiting`, body: "Approve or reject from the Leave page.", href: "/hr/leave" });
    const board = await todayBoard(tenantId, now);
    if (board.summary.late) out.push({ id: "late", level: "info", title: `${board.summary.late} late today`, body: board.items.filter((i) => i.state === "LATE").map((i) => i.employee.name).slice(0, 3).join(", "), href: "/hr/attendance" });
  }
  return out;
}
