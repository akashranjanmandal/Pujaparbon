import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { monthsBetween, istDateKey, SALES_FIELDS, type ReportKind } from "@pp/shared";
import { db } from "../../db/client";
import { productAliases, platformReports, platformSales, platforms, products } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, conflict, isUniqueViolation, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { levels, unitCost } from "../stock/service";
import { detectMapping, headersOf, isReturnsReport, missingRequired, parseSales, readRows, type Mapping } from "./importer";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;
const MAX_FILE = 8 * 1024 * 1024;

async function mine(tenantId: string, id: string) {
  const [p] = await db.select().from(platforms).where(and(eq(platforms.id, id), eq(platforms.tenantId, tenantId)));
  if (!p) throw notFound("Platform");
  return p;
}

export async function list(tenantId: string) {
  const month = istDateKey().slice(0, 7);
  const [rows, reports, sales] = await Promise.all([
    db.select().from(platforms).where(eq(platforms.tenantId, tenantId)).orderBy(platforms.name),
    db.select({ platformId: platformReports.platformId, kind: platformReports.kind, month: platformReports.month }).from(platformReports).where(eq(platformReports.tenantId, tenantId)),
    db
      .select({
        platformId: platformSales.platformId,
        net: sql<number>`sum(case when ${platformSales.status} = 'DELIVERED' and substr(${platformSales.orderDate}, 1, 7) = ${month} then ${platformSales.netPaise} else 0 end)`,
        orders: sql<number>`sum(case when ${platformSales.status} = 'DELIVERED' and substr(${platformSales.orderDate}, 1, 7) = ${month} then 1 else 0 end)`,
        total: sql<number>`sum(case when ${platformSales.status} = 'DELIVERED' then ${platformSales.netPaise} else 0 end)`,
      })
      .from(platformSales)
      .where(eq(platformSales.tenantId, tenantId))
      .groupBy(platformSales.platformId),
  ]);
  return rows.map((p) => {
    const mine = reports.filter((r) => r.platformId === p.id);
    const s = sales.find((x) => x.platformId === p.id);
    const lastMonth = mine.filter((r) => r.kind === "SALES").map((r) => r.month).sort().at(-1) ?? null;
    return { id: p.id, name: p.name, color: p.color, hasMapping: !!p.columnMap, reports: mine.length, lastSalesMonth: lastMonth, monthNetPaise: Number(s?.net ?? 0), monthOrders: Number(s?.orders ?? 0), totalNetPaise: Number(s?.total ?? 0) };
  });
}

export async function create(c: Ctx, input: { name: string; color: string }) {
  try {
    const [p] = await db.insert(platforms).values({ tenantId: c.tenantId, name: input.name, color: input.color }).returning();
    await audit(db, c, "platform.create", "platform", p.id, { name: p.name });
    return p;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict(`${input.name} is already added`);
    throw e;
  }
}

export async function update(c: Ctx, id: string, input: { name?: string; color?: string; resetMapping?: boolean }) {
  await mine(c.tenantId, id);
  const patch: Partial<typeof platforms.$inferInsert> = {};
  if (input.name) patch.name = input.name;
  if (input.color) patch.color = input.color;
  if (input.resetMapping) patch.columnMap = null;
  await db.update(platforms).set(patch).where(eq(platforms.id, id));
  return mine(c.tenantId, id);
}

/** Removes the platform and everything uploaded for it. */
export async function remove(c: Ctx, id: string) {
  const p = await mine(c.tenantId, id);
  await db.transaction(async (tx) => {
    await tx.delete(platformSales).where(eq(platformSales.platformId, id));
    await tx.delete(productAliases).where(eq(productAliases.platformId, id));
    await tx.delete(platformReports).where(eq(platformReports.platformId, id));
    await tx.delete(platforms).where(eq(platforms.id, id));
    await audit(tx, c, "platform.delete", "platform", id, { name: p.name });
  });
  return { ok: true };
}

/** Which months have a sales report and an invoice uploaded — the checklist he follows each month. */
export async function tracker(tenantId: string, platformId: string, months = 12) {
  const p = await mine(tenantId, platformId);
  const reports = await db
    .select({ id: platformReports.id, kind: platformReports.kind, month: platformReports.month, fileName: platformReports.fileName, size: platformReports.size, rowsImported: platformReports.rowsImported, rowsSkipped: platformReports.rowsSkipped, amountPaise: platformReports.amountPaise, note: platformReports.note, createdAt: platformReports.createdAt })
    .from(platformReports)
    .where(and(eq(platformReports.tenantId, tenantId), eq(platformReports.platformId, platformId)))
    .orderBy(desc(platformReports.createdAt));
  const spans = await db
    .select({ reportId: platformSales.reportId, from: sql<string>`min(${platformSales.orderDate})`, to: sql<string>`max(${platformSales.orderDate})` })
    .from(platformSales)
    .where(and(eq(platformSales.tenantId, tenantId), eq(platformSales.platformId, platformId)))
    .groupBy(platformSales.reportId);
  const spanOf = new Map(spans.map((s) => [s.reportId, { from: s.from, to: s.to }]));
  const today = istDateKey();
  const [y, m] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 - (months - 1), 1)).toISOString().slice(0, 7);
  const list = monthsBetween(start, today.slice(0, 7)).reverse();
  return {
    platform: { id: p.id, name: p.name, color: p.color, hasMapping: !!p.columnMap, columnMap: p.columnMap },
    months: list.map((month) => ({
      month,
      sales: reports.filter((r) => r.month === month && r.kind === "SALES"),
      invoices: reports.filter((r) => r.month === month && r.kind === "INVOICE"),
    })),
    reports: reports.map((r) => ({ ...r, from: spanOf.get(r.id)?.from ?? null, to: spanOf.get(r.id)?.to ?? null })),
  };
}

/** Step 1 of an upload: read the file and show how its columns will be understood. Nothing is saved. */
export async function preview(tenantId: string, platformId: string, file: { buffer: Buffer; originalname: string }) {
  const p = await mine(tenantId, platformId);
  const rows = await readRows(file);
  if (!rows.length) throw badRequest("The file has no rows. Check that it is a .csv or .xlsx with a header row.");
  const headers = headersOf(rows);
  const mapping = detectMapping(headers, p.columnMap);
  const missing = missingRequired(mapping);
  const dates = rows.map((r) => r[mapping.date ?? ""]).filter(Boolean);
  return {
    rows: rows.length, returns: isReturnsReport(headers), headers, mapping, missing, usedSaved: !!p.columnMap, fields: SALES_FIELDS,
    sample: rows.slice(0, 5), dateSample: dates.slice(0, 3),
  };
}

export async function upload(c: Ctx, platformId: string, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, input: { kind: ReportKind; month?: string; mapping?: Record<string, string>; amountPaise?: number; note?: string }) {
  const p = await mine(c.tenantId, platformId);
  if (file.size > MAX_FILE) throw badRequest("File is larger than 8 MB");
  const today = istDateKey();
  const base = { tenantId: c.tenantId, platformId, kind: input.kind, month: input.month ?? today.slice(0, 7), fileName: file.originalname, mime: file.mimetype || "application/octet-stream", size: file.size, data: file.buffer, note: input.note ?? null, createdById: c.userId };

  if (input.kind === "INVOICE") {
    const [r] = await db.insert(platformReports).values({ ...base, amountPaise: input.amountPaise ?? null }).returning({ id: platformReports.id });
    await audit(db, c, "report.invoice", "platform_report", r.id, { platform: p.name, month: base.month });
    return { id: r.id, kind: "INVOICE" as const, imported: 0, duplicates: 0, issues: [] as { row: number; message: string }[], unmatched: 0 };
  }

  const rows = await readRows(file);
  const headers = headersOf(rows);
  const mapping = detectMapping(headers, { ...(p.columnMap ?? {}), ...(input.mapping ?? {}) });
  const missing = missingRequired(mapping);
  if (missing.length) throw badRequest(`Match these columns first: ${missing.join(", ")}`);
  const { sales, issues } = parseSales(rows, mapping, today, isReturnsReport(headers));
  if (!sales.length) throw badRequest("No usable rows found in this file.");
  // The report covers whatever dates are inside it; file it under the month most of its orders fall in.
  if (!input.month) {
    const perMonth = new Map<string, number>();
    for (const s of sales) perMonth.set(s.orderDate.slice(0, 7), (perMonth.get(s.orderDate.slice(0, 7)) ?? 0) + 1);
    base.month = [...perMonth.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
  }

  const [aliases, prods, existing] = await Promise.all([
    db.select().from(productAliases).where(eq(productAliases.platformId, platformId)),
    db.select({ id: products.id, name: products.name, code: products.code }).from(products).where(eq(products.tenantId, c.tenantId)),
    db.select({ k: platformSales.lineKey }).from(platformSales).where(eq(platformSales.platformId, platformId)),
  ]);
  const byAlias = new Map(aliases.map((a) => [a.alias, a.productId]));
  const byName = new Map(prods.flatMap((x) => [[x.name.toLowerCase().trim(), x.id] as const, [x.code.toLowerCase(), x.id] as const]));
  const have = new Set(existing.map((e) => e.k));
  const fresh = sales.filter((s) => !have.has(s.lineKey));
  const costCache = new Map<string, number>();
  const costOf = async (productId: string) => {
    if (!costCache.has(productId)) costCache.set(productId, await unitCost(db, c.tenantId, productId));
    return costCache.get(productId)!;
  };

  let unmatched = 0;
  const reportId = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(platformReports)
      .values({ ...base, rowsTotal: rows.length, rowsImported: fresh.length, rowsSkipped: sales.length - fresh.length + issues.length, errors: issues.slice(0, 50) })
      .returning({ id: platformReports.id });
    for (const s of fresh) {
      const key = s.productName.toLowerCase().trim();
      const productId = byAlias.get(key) ?? byName.get(key) ?? (s.sku ? byAlias.get(s.sku.toLowerCase().trim()) ?? byName.get(s.sku.toLowerCase().trim()) : undefined) ?? null;
      if (!productId) unmatched++;
      const costPaise = productId && s.status === "DELIVERED" ? (await costOf(productId)) * s.qty : 0;
      await tx.insert(platformSales).values({ tenantId: c.tenantId, platformId, reportId: r.id, ...s, productId, costPaise });
    }
    // Remember the column match for next month.
    await tx.update(platforms).set({ columnMap: mapping as Record<string, string> }).where(eq(platforms.id, platformId));
    await audit(tx, c, "report.sales", "platform_report", r.id, { platform: p.name, month: base.month, imported: fresh.length });
    return r.id;
  });
  return { id: reportId, kind: "SALES" as const, imported: fresh.length, duplicates: sales.length - fresh.length, issues, unmatched };
}

export async function fileOf(tenantId: string, reportId: string) {
  const [r] = await db.select().from(platformReports).where(and(eq(platformReports.id, reportId), eq(platformReports.tenantId, tenantId)));
  if (!r || !r.data) throw notFound("File");
  return r;
}

export async function removeReport(c: Ctx, reportId: string) {
  const [r] = await db.select({ id: platformReports.id, fileName: platformReports.fileName }).from(platformReports).where(and(eq(platformReports.id, reportId), eq(platformReports.tenantId, c.tenantId)));
  if (!r) throw notFound("Report");
  await db.transaction(async (tx) => {
    await tx.delete(platformSales).where(eq(platformSales.reportId, reportId));
    await tx.delete(platformReports).where(eq(platformReports.id, reportId));
    await audit(tx, c, "report.delete", "platform_report", reportId, { file: r.fileName });
  });
  return { ok: true };
}

/** Sold items whose name matched none of his products: he links each once and later reports match by themselves. */
export async function unmatched(tenantId: string, platformId: string) {
  await mine(tenantId, platformId);
  const rows = await db
    .select({ name: platformSales.productName, units: sql<number>`sum(${platformSales.qty})`, netPaise: sql<number>`sum(${platformSales.netPaise})`, lines: sql<number>`count(*)` })
    .from(platformSales)
    .where(and(eq(platformSales.platformId, platformId), sql`${platformSales.productId} is null`))
    .groupBy(platformSales.productName)
    .orderBy(desc(sql`sum(${platformSales.netPaise})`))
    .limit(100);
  return rows.map((r) => ({ name: r.name, units: Number(r.units), netPaise: Number(r.netPaise), lines: Number(r.lines) }));
}

export async function mapAlias(c: Ctx, platformId: string, alias: string, productId: string) {
  await mine(c.tenantId, platformId);
  const [prod] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.tenantId, c.tenantId)));
  if (!prod) throw notFound("Product");
  const key = alias.toLowerCase().trim();
  const cost = await unitCost(db, c.tenantId, productId);
  await db.transaction(async (tx) => {
    await tx.insert(productAliases).values({ tenantId: c.tenantId, platformId, alias: key, productId }).onConflictDoUpdate({ target: [productAliases.platformId, productAliases.alias], set: { productId } });
    // Re-match everything already uploaded under that name.
    await tx
      .update(platformSales)
      .set({ productId, costPaise: sql`case when ${platformSales.status} = 'DELIVERED' then ${platformSales.qty} * ${cost} else 0 end` })
      .where(and(eq(platformSales.platformId, platformId), sql`lower(trim(${platformSales.productName})) = ${key}`));
  });
  return { ok: true };
}

export const stockSnapshot = (tenantId: string, ids: string[]) => levels(db, tenantId, ids);
export { inArray };
