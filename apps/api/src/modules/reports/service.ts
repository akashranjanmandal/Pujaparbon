import { and, between, desc, eq, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";
import { formatINR, type DateRange } from "@pp/shared";
import { db } from "../../db/client";
import { attendance, employees, platformSales, platforms, products, tenants, tripItems, trips } from "../../db/schema";
import { badRequest } from "../../lib/errors";
import { footer, letterhead, newDoc, table, type Col } from "../../lib/pdf";
import * as catalog from "../catalog/service";
import * as invest from "../investments/service";
import { summary } from "../insights/service";

export interface Report {
  title: string;
  columns: (Col & { money?: boolean })[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
}

const day = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10) : "");
const time = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(11, 16) : "");

export const REPORTS: Record<string, { title: string; ranged: boolean; blurb: string }> = {
  pnl: { title: "Profit and loss", ranged: true, blurb: "Money in, money out and profit for the period, line by line." },
  buys: { title: "Buying trips", ranged: true, blurb: "Every item bought, with its share of travel, food and other trip costs, and the real cost per piece." },
  stock: { title: "Stock and value", ranged: false, blurb: "What is on hand today, at cost and at selling price, by category." },
  sales: { title: "Sales by platform", ranged: true, blurb: "Every sale uploaded from your platform reports, with fees and what you received." },
  platforms: { title: "Platform comparison", ranged: true, blurb: "Sales, fees, cost and profit for each platform." },
  investments: { title: "Money invested", ranged: true, blurb: "Buying trips and every other investment in date order." },
  attendance: { title: "Employee attendance", ranged: true, blurb: "Daily check-in and check-out times with distance from the shop." },
};

export async function build(tenantId: string, type: string, r: DateRange): Promise<Report> {
  switch (type) {
    case "pnl": {
      const s = await summary(tenantId, r);
      const t = s.totals;
      const rows: Report["rows"] = [
        { line: "Sales (delivered, before fees)", amount: t.grossPaise },
        { line: "Platform fees and commission", amount: -t.feesPaise },
        { line: "Money received from platforms", amount: t.netPaise },
        { line: "Cost of the items sold", amount: -t.cogsPaise },
        { line: "Other investments (rent, equipment...)", amount: -t.otherPaise },
        { line: "PROFIT / LOSS ON ITEMS SOLD", amount: t.profitPaise },
        { line: "", amount: "" },
        { line: "Spent on buying trips: items", amount: t.tripsItemsPaise },
        ...s.moneyOut.tripCosts.map((k) => ({ line: `Spent on buying trips: ${k.kind}`, amount: k.amountPaise })),
        { line: "Total money out (trips + other)", amount: t.moneyOutPaise },
        { line: "Cash result (money in minus money out)", amount: t.cashPaise },
        { line: "", amount: "" },
        { line: "Orders delivered", amount: t.orders },
        { line: "Returns (value)", amount: t.returnsPaise },
      ];
      return { title: REPORTS.pnl.title, columns: [{ key: "line", label: "Line", width: 330 }, { key: "amount", label: "Amount", width: 160, align: "right", money: true }], rows: rows.map((x) => (x.line === "Orders delivered" ? { ...x, amount: `${x.amount}` } : x)) };
    }
    case "buys": {
      const rows = await db
        .select({ date: trips.date, place: trips.place, title: trips.title, name: products.name, category: products.category, qty: tripItems.qty, line: tripItems.linePaise, extra: tripItems.extraPaise, landed: tripItems.landedPaise, unit: tripItems.unitCostPaise, price: tripItems.unitPricePaise })
        .from(tripItems)
        .innerJoin(trips, eq(trips.id, tripItems.tripId))
        .innerJoin(products, eq(products.id, tripItems.productId))
        .where(and(eq(trips.tenantId, tenantId), between(trips.date, r.from, r.to)))
        .orderBy(desc(trips.date));
      return {
        title: REPORTS.buys.title,
        columns: [
          { key: "date", label: "Date", width: 52 }, { key: "place", label: "Where", width: 62 }, { key: "name", label: "Item", width: 105 }, { key: "qty", label: "Qty", width: 32, align: "right" },
          { key: "line", label: "Paid", width: 55, align: "right", money: true }, { key: "extra", label: "Trip share", width: 55, align: "right", money: true }, { key: "unit", label: "Cost/pc", width: 50, align: "right", money: true }, { key: "price", label: "Price/pc", width: 50, align: "right", money: true },
        ],
        rows: rows.map((x) => ({ date: x.date, place: x.place ?? x.title ?? "", name: x.name, qty: x.qty, line: x.line, extra: x.extra, unit: x.unit, price: x.price })),
        totals: { date: "Total", qty: rows.reduce((s, x) => s + x.qty, 0), line: rows.reduce((s, x) => s + x.line, 0), extra: rows.reduce((s, x) => s + x.extra, 0) },
      };
    }
    case "stock": {
      const s = await catalog.list(tenantId, {});
      return {
        title: REPORTS.stock.title,
        columns: [{ key: "category", label: "Category", width: 85 }, { key: "name", label: "Item", width: 130 }, { key: "code", label: "Code", width: 55 }, { key: "qty", label: "In stock", width: 45, align: "right" }, { key: "cost", label: "Cost/pc", width: 55, align: "right", money: true }, { key: "value", label: "Value at cost", width: 70, align: "right", money: true }, { key: "price", label: "Price/pc", width: 50, align: "right", money: true }],
        rows: s.items.map((i) => ({ category: i.category, name: i.name, code: i.code, qty: i.onHand, cost: i.avgCostPaise, value: i.valuePaise, price: i.sellingPricePaise })),
        totals: { category: "Total", qty: s.totals.units, value: s.totals.valuePaise },
      };
    }
    case "sales": {
      const rows = await db
        .select({ s: platformSales, platform: platforms.name })
        .from(platformSales)
        .innerJoin(platforms, eq(platforms.id, platformSales.platformId))
        .where(and(eq(platformSales.tenantId, tenantId), gte(platformSales.orderDate, r.from), lte(platformSales.orderDate, r.to)))
        .orderBy(desc(platformSales.orderDate));
      return {
        title: REPORTS.sales.title,
        columns: [{ key: "date", label: "Date", width: 52 }, { key: "platform", label: "Platform", width: 55 }, { key: "name", label: "Item", width: 115 }, { key: "qty", label: "Qty", width: 28, align: "right" }, { key: "gross", label: "Sale", width: 55, align: "right", money: true }, { key: "fees", label: "Fees", width: 45, align: "right", money: true }, { key: "net", label: "Received", width: 55, align: "right", money: true }, { key: "state", label: "State", width: 55 }, { key: "status", label: "Status", width: 50 }],
        rows: rows.map(({ s, platform }) => ({ date: s.orderDate, platform, name: s.productName, qty: s.qty, gross: s.grossPaise, fees: s.feesPaise, net: s.netPaise, state: s.state ?? "", status: s.status })),
        totals: { date: "Total", gross: rows.filter((x) => x.s.status === "DELIVERED").reduce((a, x) => a + x.s.grossPaise, 0), fees: rows.filter((x) => x.s.status === "DELIVERED").reduce((a, x) => a + x.s.feesPaise, 0), net: rows.filter((x) => x.s.status === "DELIVERED").reduce((a, x) => a + x.s.netPaise, 0) },
      };
    }
    case "platforms": {
      const s = await summary(tenantId, r);
      return {
        title: REPORTS.platforms.title,
        columns: [{ key: "name", label: "Platform", width: 90 }, { key: "orders", label: "Orders", width: 45, align: "right" }, { key: "gross", label: "Sales", width: 70, align: "right", money: true }, { key: "fees", label: "Fees", width: 60, align: "right", money: true }, { key: "net", label: "Received", width: 70, align: "right", money: true }, { key: "cogs", label: "Cost of items", width: 70, align: "right", money: true }, { key: "profit", label: "Profit", width: 70, align: "right", money: true }],
        rows: s.platforms.map((p) => ({ name: p.name, orders: p.orders, gross: p.grossPaise, fees: p.feesPaise, net: p.netPaise, cogs: p.cogsPaise, profit: p.profitPaise })),
        totals: { name: "Total", gross: s.platforms.reduce((a, p) => a + p.grossPaise, 0), fees: s.platforms.reduce((a, p) => a + p.feesPaise, 0), net: s.platforms.reduce((a, p) => a + p.netPaise, 0), cogs: s.platforms.reduce((a, p) => a + p.cogsPaise, 0), profit: s.platforms.reduce((a, p) => a + p.profitPaise, 0) },
      };
    }
    case "investments": {
      const o = await invest.overview(tenantId, r);
      return {
        title: REPORTS.investments.title,
        columns: [{ key: "date", label: "Date", width: 60 }, { key: "type", label: "Type", width: 70 }, { key: "title", label: "What", width: 180 }, { key: "category", label: "Category", width: 90 }, { key: "amount", label: "Amount", width: 80, align: "right", money: true }],
        rows: o.timeline.map((t) => ({ date: t.date, type: t.type === "BUY" ? "Buying trip" : "Other", title: t.title, category: t.category, amount: t.amountPaise })),
        totals: { date: "Total", amount: o.totalPaise },
      };
    }
    case "attendance": {
      const rows = await db
        .select({ a: attendance, name: employees.name, code: employees.code })
        .from(attendance)
        .innerJoin(employees, eq(employees.id, attendance.employeeId))
        .where(and(eq(attendance.tenantId, tenantId), between(attendance.date, r.from, r.to)))
        .orderBy(desc(attendance.date), employees.name);
      return {
        title: REPORTS.attendance.title,
        columns: [{ key: "date", label: "Date", width: 65 }, { key: "name", label: "Employee", width: 130 }, { key: "status", label: "Status", width: 65 }, { key: "in", label: "In", width: 45 }, { key: "out", label: "Out", width: 45 }, { key: "dist", label: "Distance (m)", width: 70, align: "right" }, { key: "source", label: "Source", width: 60 }],
        rows: rows.map((x) => ({ date: x.a.date, name: x.name, status: x.a.status, in: time(x.a.checkInAt), out: time(x.a.checkOutAt), dist: x.a.checkInDistanceM ?? "", source: x.a.source })),
      };
    }
    default:
      throw badRequest(`Unknown report ${type}`);
  }
}

const show = (rep: Report, row: Record<string, string | number>) =>
  Object.fromEntries(rep.columns.map((c) => [c.key, c.money && typeof row[c.key] === "number" ? formatINR(row[c.key] as number) : row[c.key] ?? ""]));

export async function toXlsx(rep: Report, business: string, range?: DateRange) {
  const wb = new ExcelJS.Workbook();
  wb.creator = business;
  const ws = wb.addWorksheet(rep.title.slice(0, 30));
  ws.mergeCells(1, 1, 1, rep.columns.length);
  ws.getCell(1, 1).value = `${business} — ${rep.title}${range ? ` (${range.from} to ${range.to})` : ""}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF2E688C" } };
  const header = ws.getRow(3);
  rep.columns.forEach((c, i) => { header.getCell(i + 1).value = c.label; ws.getColumn(i + 1).width = Math.max(11, Math.round(c.width / 5)); });
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E688C" } }));
  const write = (row: Record<string, string | number>, bold = false) => {
    const r = ws.addRow(rep.columns.map((c) => (c.money && typeof row[c.key] === "number" ? (row[c.key] as number) / 100 : row[c.key] ?? "")));
    rep.columns.forEach((c, i) => { if (c.money) r.getCell(i + 1).numFmt = '"₹"#,##,##0.00'; });
    if (bold) r.font = { bold: true };
  };
  rep.rows.forEach((row) => write(row, String(row.line ?? "").startsWith("PROFIT")));
  if (rep.totals) write(rep.totals, true);
  ws.views = [{ state: "frozen", ySplit: 3 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(rep: Report, tenantId: string, range?: DateRange) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  const { doc, done } = newDoc();
  letterhead(doc, t, rep.title, range ? `${range.from} to ${range.to}` : `As of ${day(new Date())}`);
  const rows = rep.rows.map((r) => show(rep, r));
  if (rep.totals) rows.push(show(rep, rep.totals));
  table(doc, rep.columns, rows.length ? rows : [{ [rep.columns[0].key]: "No records in this period" }]);
  footer(doc, `${t?.name ?? ""} · Seller OS`);
  doc.end();
  return done;
}
