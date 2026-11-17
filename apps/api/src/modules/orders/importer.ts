import ExcelJS from "exceljs";
import Papa from "papaparse";
import { toPaise, type ChannelCode } from "@pp/shared";

/**
 * Marketplace report files differ by channel and change over time, so we match columns by alias
 * instead of fixed positions. Aliases are normalised: lowercase, letters and digits only.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES = {
  orderId: ["order id", "order item id", "amazon order id", "order no", "sub order no", "suborder number", "store order id", "order number"],
  sku: ["sku", "seller sku", "sku id", "sku code", "seller sku code", "product sku"],
  qty: ["quantity", "qty", "quantity purchased", "item quantity", "units"],
  lineTotal: ["invoice amount", "item price", "total price", "final amount", "order amount", "total amount", "selling price total"],
  unitPrice: ["selling price per item", "selling price", "price", "seller price", "unit price", "mrp"],
  date: ["order date", "purchase date", "order date time", "created on", "order created date", "ordered on"],
  customer: ["customer name", "buyer name", "recipient name", "ship to name", "customer"],
  city: ["city", "ship city", "customer city", "shipping city", "delivery city"],
  state: ["state", "ship state", "customer state", "shipping state", "delivery state"],
  dispatchBy: ["dispatch by date", "ship by date", "dispatch by", "sla date", "promised ship date"],
  fees: ["marketplace fee", "commission", "total fees", "fees"],
  settled: ["settlement amount", "settled amount", "net amount", "bank settlement value", "payout"],
} as const;
type Field = keyof typeof ALIASES;

export interface ParsedOrder {
  channelOrderId: string;
  orderedAt: Date;
  dispatchBy: Date | null;
  customerName: string;
  city: string | null;
  state: string | null;
  items: { channelSku: string; qty: number; pricePaise: number }[];
  totalPaise: number;
}
export interface ParseIssue { row: number; message: string }

const headersOf = (rows: Record<string, string>[]) => [...new Set(rows.flatMap((r) => Object.keys(r)))];

export function mapColumns(headers: string[]) {
  const normalised = headers.map(norm);
  const map: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    for (const alias of ALIASES[field]) {
      const i = normalised.indexOf(alias);
      if (i >= 0) {
        map[field] = headers[i];
        break;
      }
    }
  }
  return map;
}

export function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, d, m, y, hh = "12", mm = "00"] = dmy;
    // Marketplace times are IST; store UTC.
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm) - 330 * 60_000);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function readRows(file: { buffer: Buffer; originalname: string }): Promise<Record<string, string>[]> {
  if (/\.xlsx$/i.test(file.originalname)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, col) => (headers[col - 1] = String(cell.text ?? "").trim()));
    const rows: Record<string, string>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => (rec[h] = String(row.getCell(i + 1).text ?? "").trim()));
      if (Object.values(rec).some(Boolean)) rows.push(rec);
    });
    return rows;
  }
  const text = file.buffer.toString("utf8").replace(/^﻿/, "");
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return res.data;
}

/** Rows -> orders. Rows sharing an order id become one multi-item order. */
export function parseOrderRows(rows: Record<string, string>[]) {
  const issues: ParseIssue[] = [];
  if (!rows.length) return { orders: [] as ParsedOrder[], issues: [{ row: 0, message: "The file has no rows" }], columns: {} };
  const col = mapColumns(headersOf(rows));
  for (const f of ["orderId", "sku"] as const) {
    if (!col[f]) issues.push({ row: 0, message: `Could not find a column for ${f === "orderId" ? "Order ID" : "SKU"}` });
  }
  if (issues.length) return { orders: [], issues, columns: col };

  const byId = new Map<string, ParsedOrder>();
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const id = r[col.orderId!]?.trim();
    const sku = r[col.sku!]?.trim();
    if (!id || !sku) return issues.push({ row: rowNo, message: "Missing order ID or SKU" });
    const qty = Math.max(1, Number.parseInt(r[col.qty ?? ""] ?? "1", 10) || 1);
    let linePaise = 0;
    try {
      if (col.lineTotal && r[col.lineTotal]) linePaise = toPaise(r[col.lineTotal]);
      else if (col.unitPrice && r[col.unitPrice]) linePaise = toPaise(r[col.unitPrice]) * qty;
    } catch {
      return issues.push({ row: rowNo, message: "Price is not a number" });
    }
    const order =
      byId.get(id) ??
      ({
        channelOrderId: id,
        orderedAt: parseDate(r[col.date ?? ""]) ?? new Date(),
        dispatchBy: parseDate(r[col.dispatchBy ?? ""]),
        customerName: r[col.customer ?? ""]?.trim() || "Marketplace customer",
        city: r[col.city ?? ""]?.trim() || null,
        state: r[col.state ?? ""]?.trim() || null,
        items: [],
        totalPaise: 0,
      } satisfies ParsedOrder);
    order.items.push({ channelSku: sku, qty, pricePaise: Math.round(linePaise / qty) });
    order.totalPaise += linePaise;
    byId.set(id, order);
  });
  return { orders: [...byId.values()], issues, columns: col };
}

export function parseSettlementRows(rows: Record<string, string>[]) {
  if (!rows.length) return { rows: [], issues: [{ row: 0, message: "The file has no rows" }] };
  const col = mapColumns(headersOf(rows));
  if (!col.orderId || !col.settled) {
    return { rows: [], issues: [{ row: 0, message: "Need an Order ID column and a Settlement Amount column" }] };
  }
  const issues: ParseIssue[] = [];
  const out: { channelOrderId: string; settledPaise: number; feesPaise: number }[] = [];
  rows.forEach((r, i) => {
    try {
      out.push({
        channelOrderId: r[col.orderId!].trim(),
        settledPaise: toPaise(r[col.settled!]),
        feesPaise: col.fees && r[col.fees] ? Math.abs(toPaise(r[col.fees])) : 0,
      });
    } catch {
      issues.push({ row: i + 2, message: "Amount is not a number" });
    }
  });
  return { rows: out, issues };
}

/** Sample files so the manager can see what each importer expects. */
export function sampleCsv(channel: ChannelCode): string {
  const headers: Record<string, string> = {
    FLIPKART: "Order Id,Order Date,SKU,FSN,Quantity,Invoice Amount,Customer Name,City,State,Dispatch By Date",
    AMAZON: "amazon-order-id,purchase-date,sku,asin,quantity-purchased,item-price,buyer-name,ship-city,ship-state,ship-by-date",
    MYNTRA: "Order No,Created On,Seller SKU Code,Style ID,Quantity,Final Amount,Customer Name,City,State,SLA Date",
    MEESHO: "Sub Order No,Order Date,SKU,Catalog ID,Quantity,Total Price,Customer Name,Customer City,Customer State,Dispatch By",
    AJIO: "Order Number,Order Date,Seller SKU,Product Code,Qty,Order Amount,Customer Name,City,State,Promised Ship Date",
  };
  const row = "OD-DEMO-1001,16-11-2026 10:30,PP-TANT-RED,ABC123,1,1499,Ananya Sen,Kolkata,West Bengal,18-11-2026";
  return `${headers[channel] ?? headers.FLIPKART}\n${row}\n`;
}
