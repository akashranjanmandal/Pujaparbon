import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { InvestmentInput } from "@pp/shared";
import { db } from "../../db/client";
import { investments, trips } from "../../db/schema";
import { audit } from "../../lib/audit";
import { notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

/** Everything he has put money into in a period: buying trips and other investments, newest first. */
export async function overview(tenantId: string, range: { from: string; to: string }) {
  const [other, buys] = await Promise.all([
    db.select().from(investments).where(and(eq(investments.tenantId, tenantId), gte(investments.date, range.from), lte(investments.date, range.to))).orderBy(desc(investments.date)),
    db.select().from(trips).where(and(eq(trips.tenantId, tenantId), gte(trips.date, range.from), lte(trips.date, range.to))).orderBy(desc(trips.date)),
  ]);
  const timeline = [
    ...buys.map((b) => ({ type: "BUY" as const, id: b.id, code: b.code, date: b.date, title: b.title || b.place || "Buying trip", detail: b.place ?? "", category: "Stock buying", amountPaise: b.totalPaise })),
    ...other.map((o) => ({ type: "OTHER" as const, id: o.id, code: null, date: o.date, title: o.label, detail: o.note ?? "", category: o.category, amountPaise: o.amountPaise })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const byCategory = new Map<string, number>();
  for (const t of timeline) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amountPaise);
  return {
    timeline,
    totalPaise: timeline.reduce((s, t) => s + t.amountPaise, 0),
    buyPaise: buys.reduce((s, b) => s + b.totalPaise, 0),
    otherPaise: other.reduce((s, o) => s + o.amountPaise, 0),
    byCategory: [...byCategory.entries()].map(([category, amountPaise]) => ({ category, amountPaise })).sort((a, b) => b.amountPaise - a.amountPaise),
  };
}

export async function categories(tenantId: string) {
  const rows = await db.selectDistinct({ category: investments.category }).from(investments).where(eq(investments.tenantId, tenantId));
  return rows.map((r) => r.category).sort();
}

export async function create(c: Ctx, input: InvestmentInput) {
  const [row] = await db.insert(investments).values({ ...input, note: input.note ?? null, tenantId: c.tenantId, createdById: c.userId }).returning();
  await audit(db, c, "investment.create", "investment", row.id, { amountPaise: row.amountPaise });
  return row;
}

export async function update(c: Ctx, id: string, input: InvestmentInput) {
  const [row] = await db.update(investments).set({ ...input, note: input.note ?? null }).where(and(eq(investments.id, id), eq(investments.tenantId, c.tenantId))).returning();
  if (!row) throw notFound("Investment");
  return row;
}

export async function remove(c: Ctx, id: string) {
  const res = await db.delete(investments).where(and(eq(investments.id, id), eq(investments.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Investment");
  await audit(db, c, "investment.delete", "investment", id);
  return { ok: true };
}

export const total = async (tenantId: string) => (await db.select({ v: sql<number>`coalesce(sum(${investments.amountPaise}), 0)` }).from(investments).where(eq(investments.tenantId, tenantId)))[0]?.v ?? 0;
