import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { istDateKey, istMinutes, monthsBetween, pctOver, previousRange, type DateRange } from "@pp/shared";
import { db } from "../../db/client";
import { employees, investments, platformReports, platformSales, platforms, products, stockMovements, tenants, tripCosts, trips, attendance } from "../../db/schema";
import { levels } from "../stock/service";

const num = (v: unknown) => Number(v ?? 0);
/** Restricts marketplace sales to the platforms of one business. */
const inBiz = (biz: string) => sql`${platformSales.platformId} in (select ${platforms.id} from ${platforms} where ${platforms.businessId} = ${biz})`;
const hhmm = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

/** Everything that adds up to profit or loss for a date range (optionally one platform). */
async function totalsFor(tenantId: string, r: DateRange, platformId?: string, biz?: string) {
  const saleWhere = [eq(platformSales.tenantId, tenantId), gte(platformSales.orderDate, r.from), lte(platformSales.orderDate, r.to)];
  if (platformId) saleWhere.push(eq(platformSales.platformId, platformId));
  if (biz) saleWhere.push(inBiz(biz));
  const [[sales], [trip], [other]] = await Promise.all([
    db
      .select({
        dGross: sql<number>`coalesce(sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.grossPaise} end), 0)`,
        dFees: sql<number>`coalesce(sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.feesPaise} end), 0)`,
        dNet: sql<number>`coalesce(sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.netPaise} end), 0)`,
        dCogs: sql<number>`coalesce(sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.costPaise} end), 0)`,
        dOrders: sql<number>`count(case when ${platformSales.status} = 'DELIVERED' then 1 end)`,
        dUnits: sql<number>`coalesce(sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.qty} end), 0)`,
        rGross: sql<number>`coalesce(sum(case when ${platformSales.status} in ('RETURNED', 'RTO') then ${platformSales.grossPaise} end), 0)`,
        rOrders: sql<number>`count(case when ${platformSales.status} in ('RETURNED', 'RTO') then 1 end)`,
        cOrders: sql<number>`count(case when ${platformSales.status} = 'CANCELLED' then 1 end)`,
      })
      .from(platformSales)
      .where(and(...saleWhere)),
    db
      .select({ items: sql<number>`coalesce(sum(${trips.itemsPaise}), 0)`, costs: sql<number>`coalesce(sum(${trips.costsPaise}), 0)`, n: sql<number>`count(*)` })
      .from(trips)
      .where(and(eq(trips.tenantId, tenantId), gte(trips.date, r.from), lte(trips.date, r.to), ...(biz ? [eq(trips.businessId, biz)] : []))),
    db
      .select({ amount: sql<number>`coalesce(sum(${investments.amountPaise}), 0)` })
      .from(investments)
      .where(and(eq(investments.tenantId, tenantId), gte(investments.date, r.from), lte(investments.date, r.to), ...(biz ? [eq(investments.businessId, biz)] : []))),
  ]);
  const t = {
    tripsItemsPaise: num(trip.items), tripsCostsPaise: num(trip.costs), trips: num(trip.n), otherPaise: num(other.amount),
    grossPaise: num(sales.dGross), feesPaise: num(sales.dFees), netPaise: num(sales.dNet), cogsPaise: num(sales.dCogs),
    orders: num(sales.dOrders), units: num(sales.dUnits), returnsPaise: num(sales.rGross), returnOrders: num(sales.rOrders), cancelledOrders: num(sales.cOrders),
  };
  const moneyOut = t.tripsItemsPaise + t.tripsCostsPaise + t.otherPaise;
  // With one platform selected only its own sales are shown; shared costs such as trips can't be split per platform.
  const profit = t.netPaise - t.cogsPaise - (platformId ? 0 : t.otherPaise);
  return { ...t, moneyOutPaise: platformId ? 0 : moneyOut, profitPaise: profit, cashPaise: platformId ? 0 : t.netPaise - moneyOut };
}

const shiftMonth = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };

export async function summary(tenantId: string, range: DateRange, platformId?: string, biz?: string) {
  // A period that reaches into the future only counts the days that have happened, and is compared with the same number of days before it.
  const today = istDateKey();
  const elapsed: DateRange = range.to > today && range.from <= today ? { from: range.from, to: today } : range;
  const saleWhere = [eq(platformSales.tenantId, tenantId), gte(platformSales.orderDate, range.from), lte(platformSales.orderDate, range.to), eq(platformSales.status, "DELIVERED")];
  if (platformId) saleWhere.push(eq(platformSales.platformId, platformId));
  if (biz) saleWhere.push(inBiz(biz));
  const tripBiz = biz ? [eq(trips.businessId, biz)] : [];
  const invBiz = biz ? [eq(investments.businessId, biz)] : [];

  const [now, before, costKinds, otherByCat, byPlatform, byProduct, byCategory, byState, lastBuy] = await Promise.all([
    totalsFor(tenantId, range, platformId, biz),
    totalsFor(tenantId, previousRange(elapsed), platformId, biz),
    db
      .select({ kind: tripCosts.kind, amount: sql<number>`sum(${tripCosts.amountPaise})` })
      .from(tripCosts)
      .innerJoin(trips, eq(trips.id, tripCosts.tripId))
      .where(and(eq(trips.tenantId, tenantId), gte(trips.date, range.from), lte(trips.date, range.to), ...tripBiz))
      .groupBy(tripCosts.kind),
    db
      .select({ category: investments.category, amount: sql<number>`sum(${investments.amountPaise})` })
      .from(investments)
      .where(and(eq(investments.tenantId, tenantId), gte(investments.date, range.from), lte(investments.date, range.to), ...invBiz))
      .groupBy(investments.category),
    db
      .select({
        id: platforms.id, name: platforms.name, color: platforms.color,
        gross: sql<number>`sum(${platformSales.grossPaise})`, fees: sql<number>`sum(${platformSales.feesPaise})`, net: sql<number>`sum(${platformSales.netPaise})`,
        cogs: sql<number>`sum(${platformSales.costPaise})`, orders: sql<number>`count(*)`, units: sql<number>`sum(${platformSales.qty})`,
      })
      .from(platformSales)
      .innerJoin(platforms, eq(platforms.id, platformSales.platformId))
      .where(and(...saleWhere))
      .groupBy(platforms.id),
    db
      .select({
        productId: platformSales.productId, name: sql<string>`coalesce(${products.name}, ${platformSales.productName})`, category: products.category,
        units: sql<number>`sum(${platformSales.qty})`, net: sql<number>`sum(${platformSales.netPaise})`, cogs: sql<number>`sum(${platformSales.costPaise})`,
      })
      .from(platformSales)
      .leftJoin(products, eq(products.id, platformSales.productId))
      .where(and(...saleWhere))
      .groupBy(sql`coalesce(${platformSales.productId}, ${platformSales.productName})`)
      .limit(200),
    db
      .select({ category: sql<string>`coalesce(${products.category}, 'Not matched yet')`, net: sql<number>`sum(${platformSales.netPaise})`, cogs: sql<number>`sum(${platformSales.costPaise})`, units: sql<number>`sum(${platformSales.qty})` })
      .from(platformSales)
      .leftJoin(products, eq(products.id, platformSales.productId))
      .where(and(...saleWhere))
      .groupBy(sql`coalesce(${products.category}, 'Not matched yet')`),
    db
      .select({ state: sql<string>`coalesce(${platformSales.state}, 'Unknown')`, net: sql<number>`sum(${platformSales.netPaise})`, orders: sql<number>`count(*)` })
      .from(platformSales)
      .where(and(...saleWhere))
      .groupBy(sql`coalesce(${platformSales.state}, 'Unknown')`)
      .orderBy(desc(sql`sum(${platformSales.netPaise})`)),
    db.select({ date: trips.date }).from(trips).where(and(eq(trips.tenantId, tenantId), ...tripBiz)).orderBy(desc(trips.date)).limit(1),
  ]);

  // Month-by-month: always the last six months (or the whole range if it is longer), so the chart is never a single dot.
  const lastMonth = elapsed.to.slice(0, 7);
  const firstMonth = range.from.slice(0, 7) < shiftMonth(lastMonth, -5) ? range.from.slice(0, 7) : shiftMonth(lastMonth, -5);
  const months = monthsBetween(firstMonth, lastMonth).slice(-24);
  const tFrom = `${months[0]}-01`, tTo = `${months.at(-1)}-31`;
  const trendSale = [eq(platformSales.tenantId, tenantId), gte(platformSales.orderDate, tFrom), lte(platformSales.orderDate, tTo), eq(platformSales.status, "DELIVERED")];
  if (platformId) trendSale.push(eq(platformSales.platformId, platformId));
  if (biz) trendSale.push(inBiz(biz));
  const monthExprT = sql<string>`substr(${trips.date}, 1, 7)`;
  const monthExprI = sql<string>`substr(${investments.date}, 1, 7)`;
  const monthExprS = sql<string>`substr(${platformSales.orderDate}, 1, 7)`;
  const [mTrips, mOther, mSales] = await Promise.all([
    db.select({ m: monthExprT, v: sql<number>`sum(${trips.totalPaise})` }).from(trips).where(and(eq(trips.tenantId, tenantId), gte(trips.date, tFrom), lte(trips.date, tTo), ...tripBiz)).groupBy(monthExprT),
    db.select({ m: monthExprI, v: sql<number>`sum(${investments.amountPaise})` }).from(investments).where(and(eq(investments.tenantId, tenantId), gte(investments.date, tFrom), lte(investments.date, tTo), ...invBiz)).groupBy(monthExprI),
    db.select({ m: monthExprS, net: sql<number>`sum(${platformSales.netPaise})`, cogs: sql<number>`sum(${platformSales.costPaise})` }).from(platformSales).where(and(...trendSale)).groupBy(monthExprS),
  ]);
  const trend = months.map((m) => {
    const out = num(mTrips.find((x) => x.m === m)?.v) + num(mOther.find((x) => x.m === m)?.v);
    const s = mSales.find((x) => x.m === m);
    const net = num(s?.net), cogs = num(s?.cogs);
    return { month: m, moneyOutPaise: platformId ? 0 : out, netPaise: net, profitPaise: net - cogs - (platformId ? 0 : num(mOther.find((x) => x.m === m)?.v)) };
  });

  const bizProducts = biz ? (await db.select({ id: products.id }).from(products).where(and(eq(products.tenantId, tenantId), eq(products.businessId, biz)))).map((p) => p.id) : undefined;
  const lv = bizProducts && !bizProducts.length ? new Map() : await levels(db, tenantId, bizProducts);
  const stockValue = [...lv.values()].reduce((s, l) => s + l.valuePaise, 0);
  const stockUnits = [...lv.values()].reduce((s, l) => s + Math.max(0, l.qty), 0);
  const lastCount = [...lv.values()].reduce<number | null>((m, l) => (l.lastCountAt && (!m || l.lastCountAt > m) ? l.lastCountAt : m), null);

  const prodRows = byProduct
    .filter((p) => p.productId !== null)
    .map((p) => ({ productId: p.productId, name: p.name, category: p.category, units: num(p.units), netPaise: num(p.net), profitPaise: num(p.net) - num(p.cogs), marginPct: pctOver(num(p.cogs), num(p.net)) }))
    .sort((a, b) => b.profitPaise - a.profitPaise);

  const delta = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / Math.abs(b)) * 1000) / 10);
  return {
    range, platformId: platformId ?? null,
    totals: now,
    compare: { profitPct: delta(now.profitPaise, before.profitPaise), netPct: delta(now.netPaise, before.netPaise), moneyOutPct: delta(now.moneyOutPaise, before.moneyOutPaise), days: Math.round((Date.parse(`${elapsed.to}T00:00:00Z`) - Date.parse(`${elapsed.from}T00:00:00Z`)) / 86_400_000) + 1, previous: before },
    moneyOut: {
      itemsPaise: now.tripsItemsPaise,
      tripCosts: costKinds.map((k) => ({ kind: k.kind, amountPaise: num(k.amount) })).sort((a, b) => b.amountPaise - a.amountPaise),
      other: otherByCat.map((k) => ({ category: k.category, amountPaise: num(k.amount) })).sort((a, b) => b.amountPaise - a.amountPaise),
    },
    platforms: byPlatform.map((p) => ({ id: p.id, name: p.name, color: p.color, grossPaise: num(p.gross), feesPaise: num(p.fees), netPaise: num(p.net), cogsPaise: num(p.cogs), profitPaise: num(p.net) - num(p.cogs), orders: num(p.orders), units: num(p.units), feePct: num(p.gross) ? Math.round((num(p.fees) / num(p.gross)) * 1000) / 10 : 0 })).sort((a, b) => b.profitPaise - a.profitPaise),
    products: { best: prodRows.filter((p) => p.profitPaise > 0).slice(0, 8), worst: [...prodRows].reverse().filter((p) => p.profitPaise <= 0 || p.marginPct < 10).slice(0, 8) },
    categories: byCategory.map((c) => ({ category: c.category, netPaise: num(c.net), profitPaise: num(c.net) - num(c.cogs), units: num(c.units) })).sort((a, b) => b.netPaise - a.netPaise),
    states: byState.slice(0, 15).map((s) => ({ state: s.state, netPaise: num(s.net), orders: num(s.orders) })),
    trend,
    stock: { valuePaise: stockValue, units: stockUnits, lastCountAt: lastCount, lastBuyDate: lastBuy[0]?.date ?? null },
  };
}

export type Attention = { id: string; level: "critical" | "warning" | "info"; title: string; body: string; href: string };

/** Things the owner should do today, computed live. */
export async function attention(tenantId: string, biz?: string, now = new Date()): Promise<Attention[]> {
  const out: Attention[] = [];
  const prods = await db.select({ id: products.id }).from(products).where(and(eq(products.tenantId, tenantId), isNull(products.archivedAt), ...(biz ? [eq(products.businessId, biz)] : [])));
  const lv = prods.length ? await levels(db, tenantId, biz ? prods.map((p) => p.id) : undefined) : new Map();
  if (prods.length) {
    const last = [...lv.values()].reduce<number | null>((m, l) => (l.lastCountAt && (!m || l.lastCountAt > m) ? l.lastCountAt : m), null);
    const days = last ? Math.floor((now.getTime() - last) / 86_400_000) : null;
    if (days === null || days >= 2) out.push({ id: "count", level: "warning", title: days === null ? "Stock has never been counted" : `Stock not counted for ${days} days`, body: "Take two minutes to update today's counts so your numbers stay true.", href: "/stock?count=1" });
  }
  const month = istDateKey(now).slice(0, 7);
  const prev = (() => { const [y, m] = month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; })();
  const [plats, reps] = await Promise.all([
    db.select({ id: platforms.id, name: platforms.name }).from(platforms).where(and(eq(platforms.tenantId, tenantId), ...(biz ? [eq(platforms.businessId, biz)] : []))),
    db.select({ platformId: platformReports.platformId, kind: platformReports.kind }).from(platformReports).where(and(eq(platformReports.tenantId, tenantId), eq(platformReports.month, prev))),
  ]);
  for (const p of plats) {
    const has = reps.some((r) => r.platformId === p.id && r.kind === "SALES");
    if (!has) out.push({ id: `rep-${p.id}`, level: "warning", title: `${p.name}: last month's sales report is missing`, body: "Upload it so your profit figures include it.", href: `/platforms/${p.id}` });
  }
  const [{ n: unmatched }] = await db.select({ n: sql<number>`count(distinct ${platformSales.productName})` }).from(platformSales).where(and(eq(platformSales.tenantId, tenantId), isNull(platformSales.productId), ...(biz ? [inBiz(biz)] : [])));
  if (num(unmatched) > 0) out.push({ id: "unmatched", level: "info", title: `${unmatched} sold ${num(unmatched) === 1 ? "item is" : "items are"} not matched to your products`, body: "Match them once so profit counts their cost.", href: "/platforms" });
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (t) {
    const nowMin = istMinutes(now);
    if (nowMin > hhmm(t.shiftStart) + t.lateGraceMin) {
      const [{ n: staff }] = await db.select({ n: sql<number>`count(*)` }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.active, true)));
      const [{ n: inN }] = await db.select({ n: sql<number>`count(*)` }).from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, istDateKey(now)), sql`${attendance.checkInAt} is not null`));
      const missing = num(staff) - num(inN);
      if (missing > 0) out.push({ id: "att", level: "info", title: `${missing} ${missing === 1 ? "employee has" : "employees have"} not checked in`, body: "See who is in on the Attendance page.", href: "/hr/attendance" });
    }
  }
  return out;
}

export async function recentActivity(tenantId: string, biz?: string) {
  const [recentTrips, recentReports] = await Promise.all([
    db.select({ id: trips.id, date: trips.date, title: trips.title, place: trips.place, totalPaise: trips.totalPaise, code: trips.code }).from(trips).where(and(eq(trips.tenantId, tenantId), ...(biz ? [eq(trips.businessId, biz)] : []))).orderBy(desc(trips.date), desc(trips.createdAt)).limit(5),
    db.select({ id: platformReports.id, platformId: platformReports.platformId, kind: platformReports.kind, month: platformReports.month, fileName: platformReports.fileName, createdAt: platformReports.createdAt, rows: platformReports.rowsImported }).from(platformReports).where(and(eq(platformReports.tenantId, tenantId), ...(biz ? [sql`${platformReports.platformId} in (select ${platforms.id} from ${platforms} where ${platforms.businessId} = ${biz})`] : []))).orderBy(desc(platformReports.createdAt)).limit(5),
  ]);
  return { trips: recentTrips, reports: recentReports };
}

export const lastMovement = (tenantId: string) => db.select({ at: sql<number>`max(${stockMovements.createdAt})` }).from(stockMovements).where(eq(stockMovements.tenantId, tenantId));
