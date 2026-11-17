import { and, between, desc, eq, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";
import { formatINR, type Permission } from "@pp/shared";
import { db } from "../../db/client";
import {
  attendance, channels, employees, invoiceItems, invoices, orders, payslips, products, returns, stockMovements, tenants, users, variants,
} from "../../db/schema";
import { badRequest } from "../../lib/errors";
import { footer, letterhead, newDoc, table, type Col } from "../../lib/pdf";
import { list as stockList } from "../stock/service";

export interface Report {
  title: string;
  columns: (Col & { money?: boolean })[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
}

type Range = { from: string; to: string };
const ms = (d: string, end = false) => new Date(`${d}T${end ? "23:59:59" : "00:00:00"}+05:30`);
const day = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10) : "");
const time = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(11, 16) : "");
const rs = (p: number) => formatINR(p);

export const REPORTS: Record<string, { title: string; permission: Permission; ranged: boolean }> = {
  stock: { title: "Stock on hand", permission: "reports.view", ranged: false },
  movements: { title: "Inward / outward register", permission: "reports.view", ranged: true },
  sales: { title: "Sales by order", permission: "reports.view", ranged: true },
  dispatch: { title: "Dispatch register", permission: "reports.view", ranged: true },
  returns: { title: "Returns register", permission: "reports.view", ranged: true },
  attendance: { title: "Attendance register", permission: "reports.view", ranged: true },
  gst: { title: "GST summary (GSTR-1 style)", permission: "reports.view", ranged: true },
  payroll: { title: "Payroll register", permission: "payroll.manage", ranged: true },
};

export async function build(tenantId: string, type: string, r: Range): Promise<Report> {
  switch (type) {
    case "stock": {
      const s = await stockList(tenantId, {});
      return {
        title: REPORTS.stock.title,
        columns: [
          { key: "sku", label: "SKU", width: 95 }, { key: "name", label: "Product", width: 150 }, { key: "category", label: "Category", width: 80 },
          { key: "bin", label: "Bin", width: 50 }, { key: "onHand", label: "On hand", width: 50, align: "right" },
          { key: "committed", label: "Committed", width: 55, align: "right" }, { key: "value", label: "Value at cost", width: 80, align: "right", money: true },
        ],
        rows: s.items.map((i) => ({ sku: i.sku, name: i.name, category: i.category, bin: i.bins[0]?.code ?? "", onHand: i.onHand, committed: i.committed, value: i.onHand * i.costPaise })),
        totals: { sku: "Total", onHand: s.totals.units, value: s.totals.valueAtCostPaise },
      };
    }
    case "movements": {
      const rows = await db
        .select({ m: stockMovements, sku: variants.sku, name: products.name, by: users.name })
        .from(stockMovements)
        .innerJoin(variants, eq(variants.id, stockMovements.variantId))
        .innerJoin(products, eq(products.id, variants.productId))
        .leftJoin(users, eq(users.id, stockMovements.userId))
        .where(and(eq(stockMovements.tenantId, tenantId), gte(stockMovements.createdAt, ms(r.from)), lte(stockMovements.createdAt, ms(r.to, true))))
        .orderBy(desc(stockMovements.createdAt));
      return {
        title: REPORTS.movements.title,
        columns: [
          { key: "date", label: "Date", width: 60 }, { key: "type", label: "Type", width: 65 }, { key: "sku", label: "SKU", width: 95 },
          { key: "name", label: "Product", width: 120 }, { key: "qty", label: "Qty", width: 40, align: "right" }, { key: "reason", label: "Reason", width: 105 }, { key: "by", label: "By", width: 50 },
        ],
        rows: rows.map((x) => ({ date: day(x.m.createdAt), type: x.m.type, sku: x.sku, name: x.name, qty: x.m.qty, reason: x.m.reason ?? "", by: x.by ?? "" })),
      };
    }
    case "sales":
    case "dispatch": {
      const rows = await db
        .select({ o: orders, channel: channels.name })
        .from(orders)
        .innerJoin(channels, eq(channels.id, orders.channelId))
        .where(and(eq(orders.tenantId, tenantId), type === "dispatch" ? gte(orders.dispatchedAt, ms(r.from)) : gte(orders.orderedAt, ms(r.from)), type === "dispatch" ? lte(orders.dispatchedAt, ms(r.to, true)) : lte(orders.orderedAt, ms(r.to, true))))
        .orderBy(desc(orders.orderedAt));
      const total = rows.reduce((s, x) => s + x.o.totalPaise, 0);
      return {
        title: REPORTS[type].title,
        columns: [
          { key: "date", label: type === "dispatch" ? "Dispatched" : "Ordered", width: 60 }, { key: "channel", label: "Channel", width: 70 },
          { key: "id", label: "Order ID", width: 110 }, { key: "customer", label: "Customer", width: 100 }, { key: "state", label: "State", width: 70 },
          { key: "status", label: "Status", width: 60 }, { key: "total", label: "Value", width: 70, align: "right", money: true },
        ],
        rows: rows.map(({ o, channel }) => ({ date: day(type === "dispatch" ? o.dispatchedAt : o.orderedAt), channel, id: o.channelOrderId, customer: o.customerName, state: o.state ?? "", status: o.status, total: o.totalPaise })),
        totals: { date: "Total", id: `${rows.length} orders`, total },
      };
    }
    case "returns": {
      const rows = await db
        .select({ r: returns, id: orders.channelOrderId, channel: channels.name, sku: variants.sku })
        .from(returns)
        .innerJoin(orders, eq(orders.id, returns.orderId))
        .innerJoin(channels, eq(channels.id, orders.channelId))
        .innerJoin(variants, eq(variants.id, returns.variantId))
        .where(and(eq(returns.tenantId, tenantId), gte(returns.createdAt, ms(r.from)), lte(returns.createdAt, ms(r.to, true))))
        .orderBy(desc(returns.createdAt));
      return {
        title: REPORTS.returns.title,
        columns: [
          { key: "date", label: "Date", width: 60 }, { key: "channel", label: "Channel", width: 65 }, { key: "id", label: "Order ID", width: 105 },
          { key: "sku", label: "SKU", width: 90 }, { key: "qty", label: "Qty", width: 35, align: "right" }, { key: "type", label: "Type", width: 55 },
          { key: "condition", label: "Condition", width: 55 }, { key: "reason", label: "Reason", width: 70 },
        ],
        rows: rows.map((x) => ({ date: day(x.r.createdAt), channel: x.channel, id: x.id, sku: x.sku, qty: x.r.qty, type: x.r.type, condition: x.r.condition, reason: x.r.reason })),
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
        columns: [
          { key: "date", label: "Date", width: 65 }, { key: "code", label: "Code", width: 55 }, { key: "name", label: "Employee", width: 120 },
          { key: "status", label: "Status", width: 65 }, { key: "in", label: "In", width: 45 }, { key: "out", label: "Out", width: 45 },
          { key: "dist", label: "Distance (m)", width: 65, align: "right" }, { key: "source", label: "Source", width: 55 },
        ],
        rows: rows.map((x) => ({ date: x.a.date, code: x.code, name: x.name, status: x.a.status, in: time(x.a.checkInAt), out: time(x.a.checkOutAt), dist: x.a.checkInDistanceM ?? "", source: x.a.source })),
      };
    }
    case "gst": {
      const rows = await db
        .select({ inv: invoices, item: invoiceItems })
        .from(invoiceItems)
        .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, "ISSUED"), between(invoices.date, r.from, r.to)));
      // HSN-wise summary, split by rate, the way GSTR-1 Table 12 asks for it.
      const map = new Map<string, { hsn: string; rate: number; qty: number; taxable: number; tax: number; b2b: number }>();
      for (const { inv, item } of rows) {
        const k = `${item.hsn}-${item.gstRate}`;
        const e = map.get(k) ?? { hsn: item.hsn, rate: item.gstRate, qty: 0, taxable: 0, tax: 0, b2b: 0 };
        e.qty += item.qty;
        e.taxable += item.taxablePaise;
        e.tax += item.taxPaise;
        if (inv.customerGstin) e.b2b += item.taxablePaise;
        map.set(k, e);
      }
      const list = [...map.values()].sort((a, b) => a.hsn.localeCompare(b.hsn));
      return {
        title: REPORTS.gst.title,
        columns: [
          { key: "hsn", label: "HSN", width: 70 }, { key: "rate", label: "GST %", width: 50, align: "right" }, { key: "qty", label: "Qty", width: 50, align: "right" },
          { key: "taxable", label: "Taxable value", width: 95, align: "right", money: true }, { key: "b2b", label: "of which B2B", width: 90, align: "right", money: true },
          { key: "tax", label: "Total tax", width: 90, align: "right", money: true },
        ],
        rows: list.map((e) => ({ ...e })),
        totals: { hsn: "Total", taxable: list.reduce((s, e) => s + e.taxable, 0), b2b: list.reduce((s, e) => s + e.b2b, 0), tax: list.reduce((s, e) => s + e.tax, 0) },
      };
    }
    case "payroll": {
      const rows = await db
        .select({ p: payslips, name: employees.name, code: employees.code })
        .from(payslips)
        .innerJoin(employees, eq(employees.id, payslips.employeeId))
        .where(and(eq(payslips.tenantId, tenantId), between(payslips.month, r.from.slice(0, 7), r.to.slice(0, 7))))
        .orderBy(desc(payslips.month), employees.name);
      return {
        title: REPORTS.payroll.title,
        columns: [
          { key: "month", label: "Month", width: 55 }, { key: "code", label: "Code", width: 55 }, { key: "name", label: "Employee", width: 115 },
          { key: "days", label: "Payable days", width: 65, align: "right" }, { key: "gross", label: "Gross", width: 75, align: "right", money: true },
          { key: "adv", label: "Advance", width: 65, align: "right", money: true }, { key: "net", label: "Net", width: 75, align: "right", money: true },
        ],
        rows: rows.map((x) => ({ month: x.p.month, code: x.code, name: x.name, days: x.p.payableDays, gross: x.p.grossPaise, adv: x.p.advancePaise, net: x.p.netPaise })),
        totals: { month: "Total", net: rows.reduce((s, x) => s + x.p.netPaise, 0), gross: rows.reduce((s, x) => s + x.p.grossPaise, 0) },
      };
    }
    default:
      throw badRequest(`Unknown report ${type}`);
  }
}

const display = (rep: Report, row: Record<string, string | number>) =>
  Object.fromEntries(rep.columns.map((c) => [c.key, c.money && typeof row[c.key] === "number" ? rs(row[c.key] as number) : row[c.key] ?? ""]));

export async function toXlsx(rep: Report, business: string, range?: Range) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Puja Parbon Seller OS";
  const ws = wb.addWorksheet(rep.title.slice(0, 30));
  ws.mergeCells(1, 1, 1, rep.columns.length);
  ws.getCell(1, 1).value = `${business} — ${rep.title}${range ? ` (${range.from} to ${range.to})` : ""}`;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF9E1B32" } };
  const header = ws.getRow(3);
  rep.columns.forEach((c, i) => {
    header.getCell(i + 1).value = c.label;
    ws.getColumn(i + 1).width = Math.max(10, Math.round(c.width / 5.5));
  });
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9E1B32" } }));
  const write = (row: Record<string, string | number>, bold = false) => {
    const r = ws.addRow(rep.columns.map((c) => (c.money && typeof row[c.key] === "number" ? (row[c.key] as number) / 100 : row[c.key] ?? "")));
    rep.columns.forEach((c, i) => {
      if (c.money) r.getCell(i + 1).numFmt = '"₹"#,##,##0.00';
    });
    if (bold) r.font = { bold: true };
  };
  rep.rows.forEach((row) => write(row));
  if (rep.totals) write(rep.totals, true);
  ws.views = [{ state: "frozen", ySplit: 3 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(rep: Report, tenantId: string, range?: Range) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  const { doc, done } = newDoc();
  letterhead(doc, t, rep.title, range ? `${range.from} to ${range.to}` : `As of ${day(new Date())}`);
  const rows = rep.rows.map((r) => display(rep, r));
  if (rep.totals) rows.push(display(rep, rep.totals));
  table(doc, rep.columns, rows.length ? rows : [{ [rep.columns[0].key]: "No records in this period" }]);
  footer(doc);
  doc.end();
  return done;
}
