import ExcelJS from "exceljs";
import Papa from "papaparse";
import { SALES_FIELDS, toPaise, type SaleStatus, type SalesFieldKey } from "@pp/shared";

/**
 * Every platform names its report columns differently. We guess by common names; if a platform's file is unfamiliar
 * the owner matches the columns once and we remember it (stored on the platform).
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES: Record<SalesFieldKey, string[]> = {
  orderId: ["order id", "order item id", "amazon order id", "order no", "order number", "sub order no", "suborder number", "suborder id", "store order id", "order"],
  date: ["order date", "purchase date", "order date time", "order created date", "ordered on", "created on", "date", "invoice date", "order placed date"],
  product: ["product name", "product", "item name", "title", "product title", "listing title", "item", "description", "product description"],
  sku: ["sku", "seller sku", "sku id", "sku code", "seller sku code", "product sku", "style code", "fsn", "asin", "catalog id"],
  qty: ["quantity", "qty", "quantity purchased", "item quantity", "units", "units sold"],
  amount: ["sale amount", "selling price", "invoice amount", "item price", "total price", "final amount", "order amount", "total amount", "sale value", "selling price total", "gross amount", "amount"],
  fees: ["platform fee", "marketplace fee", "commission", "total fees", "fees", "commission fee", "fee", "total marketplace fee", "referral fee"],
  settled: ["settlement amount", "settled amount", "net amount", "bank settlement value", "payout", "net payout", "amount received", "settlement value", "net settlement"],
  state: ["state", "customer state", "ship state", "shipping state", "delivery state", "buyer state", "ship to state"],
  status: ["status", "order status", "item status", "shipment status", "delivery status", "return status"],
};

export type Mapping = Partial<Record<SalesFieldKey, string>>;
const headersOf = (rows: Record<string, string>[]) => [...new Set(rows.flatMap((r) => Object.keys(r)))];

/** Order matters in the second pass: specific fields claim their columns before the general "amount" does. */
const PRIORITY: SalesFieldKey[] = ["settled", "fees", "state", "status", "date", "orderId", "qty", "sku", "product", "amount"];
const hasWord = (header: string, alias: string) => ` ${header} `.includes(` ${alias} `);

/** Best guess for each field, preferring a saved mapping whose headers still exist in this file. */
export function detectMapping(headers: string[], saved?: Mapping | null): Mapping {
  const out: Mapping = {};
  const used = new Set<string>();
  const n = headers.map(norm);
  const take = (key: SalesFieldKey, header: string) => { out[key] = header; used.add(header); };
  for (const f of SALES_FIELDS) {
    const s = saved?.[f.key];
    if (s && headers.includes(s)) take(f.key, s);
  }
  // pass 1: the header is exactly a known name
  for (const f of SALES_FIELDS) {
    if (out[f.key]) continue;
    for (const alias of ALIASES[f.key]) {
      const i = n.indexOf(alias);
      if (i >= 0 && !used.has(headers[i])) { take(f.key, headers[i]); break; }
    }
  }
  // pass 2: the header contains a known name as a whole word ("Item Title", "Amount Paid")
  for (const key of PRIORITY) {
    if (out[key]) continue;
    outer: for (const alias of ALIASES[key]) {
      for (let i = 0; i < headers.length; i++) {
        if (!used.has(headers[i]) && hasWord(n[i], alias)) { take(key, headers[i]); break outer; }
      }
    }
  }
  return out;
}

export function missingRequired(mapping: Mapping) {
  const missing: string[] = [];
  if (!mapping.amount) missing.push("Sale amount");
  if (!mapping.product && !mapping.sku) missing.push("Product name or SKU");
  return missing;
}

/** Accepts 16-11-2026, 2026-11-16, 16/11/26, "16 Nov 2026" and Excel serial numbers. Returns an IST YYYY-MM-DD key. */
export function parseDateKey(v: string | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmy) {
    const y = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
    return `${y}-${String(+dmy[2]).padStart(2, "0")}-${String(+dmy[1]).padStart(2, "0")}`;
  }
  if (/^\d{5}$/.test(s)) return new Date(Math.round((+s - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t + 330 * 60_000).toISOString().slice(0, 10);
}

export const parseStatus = (v: string | undefined): SaleStatus => {
  const s = (v ?? "").toLowerCase();
  if (/cancel/.test(s)) return "CANCELLED";
  if (/return|rto|refund|rts/.test(s)) return "RETURNED";
  return "DELIVERED";
};

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
      headers.forEach((h, i) => { if (h) rec[h] = String(row.getCell(i + 1).text ?? "").trim(); });
      if (Object.values(rec).some(Boolean)) rows.push(rec);
    });
    return rows;
  }
  const text = file.buffer.toString("utf8").replace(/^﻿/, "");
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() }).data;
}

export interface ParsedSale {
  lineKey: string; orderId: string | null; orderDate: string; productName: string; sku: string | null; qty: number;
  grossPaise: number; feesPaise: number; netPaise: number; state: string | null; status: SaleStatus;
}
export interface ParseIssue { row: number; message: string }

export function parseSales(rows: Record<string, string>[], mapping: Mapping, fallbackDate: string) {
  const sales: ParsedSale[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Map<string, number>();
  const get = (r: Record<string, string>, k: SalesFieldKey) => (mapping[k] ? (r[mapping[k]!] ?? "").toString().trim() : "");
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const name = get(r, "product") || get(r, "sku");
    if (!name) return issues.push({ row: rowNo, message: "No product name or SKU" });
    let gross = 0, fees = 0, settled: number | null = null;
    try {
      gross = Math.abs(toPaise(get(r, "amount") || "0"));
      fees = get(r, "fees") ? Math.abs(toPaise(get(r, "fees"))) : 0;
      settled = get(r, "settled") ? toPaise(get(r, "settled")) : null;
    } catch {
      return issues.push({ row: rowNo, message: "An amount is not a number" });
    }
    if (!gross && settled == null) return issues.push({ row: rowNo, message: "No sale amount" });
    const qty = Math.max(1, Number.parseInt(get(r, "qty") || "1", 10) || 1);
    const orderId = get(r, "orderId") || null;
    const base = orderId ?? `row-${rowNo}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    sales.push({
      lineKey: `${base}#${n}`, orderId, orderDate: parseDateKey(get(r, "date")) ?? fallbackDate, productName: name, sku: get(r, "sku") || null, qty,
      grossPaise: gross, feesPaise: fees, netPaise: settled != null ? Math.abs(settled) : Math.max(0, gross - fees),
      state: get(r, "state") || null, status: parseStatus(get(r, "status")),
    });
  });
  return { sales, issues };
}

export { headersOf };

export const SAMPLE_CSV =
  "Order ID,Order Date,Product,SKU,Quantity,Sale Amount,Platform Fee,Settlement Amount,State,Status\n" +
  "OD-1001,16-11-2026,Steel Water Bottle 1L,BOT-1L,2,998,150,848,West Bengal,Delivered\n" +
  "OD-1002,17-11-2026,Plastic Lunch Box,LUN-01,1,299,45,254,Karnataka,Delivered\n" +
  "OD-1003,17-11-2026,Steel Water Bottle 1L,BOT-1L,1,499,0,0,Delhi,Returned\n";
