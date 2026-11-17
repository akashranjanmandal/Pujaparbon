import { and, eq, like, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { invoices, purchases } from "../db/schema";

/** Indian financial year label, e.g. 2026-11-17 -> "26-27". */
export function financialYear(date = new Date()) {
  const y = date.getFullYear() % 100;
  return date.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export async function nextNumber(ex: Executor, tenantId: string, kind: "INV" | "PO") {
  const prefix = `PP/${kind}/${financialYear()}/`;
  const table = kind === "INV" ? invoices : purchases;
  const [row] = await ex
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .where(and(eq(table.tenantId, tenantId), like(table.number, `${prefix}%`)));
  return `${prefix}${String(Number(row?.n ?? 0) + 1).padStart(4, "0")}`;
}
