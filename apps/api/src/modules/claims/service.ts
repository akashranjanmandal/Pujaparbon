import { and, desc, eq } from "drizzle-orm";
import { claimSchema } from "@pp/shared";
import type { z } from "zod";
import { db } from "../../db/client";
import { claims, platforms, products } from "../../db/schema";
import { audit } from "../../lib/audit";
import { badRequest, notFound } from "../../lib/errors";
import { productsIn } from "../../lib/isolation";
import type { AuthContext } from "../../lib/http";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;
type Input = z.infer<typeof claimSchema>;

/** A claim belongs to its platform's business, and its item must be of that business too. */
async function check(tenantId: string, i: Partial<Input>) {
  if (!i.platformId) return;
  const [pl] = await db.select({ b: platforms.businessId }).from(platforms).where(and(eq(platforms.id, i.platformId), eq(platforms.tenantId, tenantId)));
  if (!pl?.b) throw badRequest("Unknown platform");
  await productsIn(db, tenantId, pl.b, i.productId ? [i.productId] : []);
}

export async function list(tenantId: string, businessId: string, platformId?: string) {
  const where = [eq(claims.tenantId, tenantId), eq(platforms.businessId, businessId)];
  if (platformId) where.push(eq(claims.platformId, platformId));
  const rows = await db
    .select({ id: claims.id, platformId: claims.platformId, platform: platforms.name, orderId: claims.orderId, date: claims.date, kind: claims.kind, status: claims.status, reason: claims.reason, expectedPaise: claims.expectedPaise, receivedPaise: claims.receivedPaise, note: claims.note, product: products.name })
    .from(claims)
    .innerJoin(platforms, eq(platforms.id, claims.platformId))
    .leftJoin(products, eq(products.id, claims.productId))
    .where(and(...where))
    .orderBy(desc(claims.date), desc(claims.createdAt))
    .limit(500);
  const done = rows.filter((r) => r.status !== "RAISED");
  const approved = rows.filter((r) => r.status === "APPROVED");
  const summary = {
    raised: rows.length, approved: approved.length, rejected: rows.filter((r) => r.status === "REJECTED").length, pending: rows.length - done.length,
    expectedPaise: approved.reduce((s, r) => s + r.expectedPaise, 0), receivedPaise: approved.reduce((s, r) => s + r.receivedPaise, 0),
    // Rejected claims are money not recovered, at the value he expected.
    rejectedPaise: rows.filter((r) => r.status === "REJECTED").reduce((s, r) => s + r.expectedPaise, 0),
  };
  return { summary: { ...summary, shortfallPaise: summary.expectedPaise - summary.receivedPaise }, claims: rows.map((r) => ({ ...r, gapPaise: r.status === "APPROVED" ? r.expectedPaise - r.receivedPaise : 0 })) };
}

export async function create(c: Ctx, input: Input) {
  await check(c.tenantId, input);
  const [row] = await db.insert(claims).values({ ...input, productId: input.productId ?? null, reason: input.reason ?? null, note: input.note ?? null, tenantId: c.tenantId, createdById: c.userId }).returning();
  await audit(db, c, "claim.create", "claim", row.id, { orderId: row.orderId });
  return row;
}

export async function update(c: Ctx, id: string, input: Partial<Input>) {
  await check(c.tenantId, input);
  const res = await db.update(claims).set(input).where(and(eq(claims.id, id), eq(claims.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Claim");
  await audit(db, c, "claim.update", "claim", id, { status: input.status });
  const [row] = await db.select().from(claims).where(eq(claims.id, id));
  return row;
}

export async function remove(c: Ctx, id: string) {
  const res = await db.delete(claims).where(and(eq(claims.id, id), eq(claims.tenantId, c.tenantId)));
  if (!res.rowsAffected) throw notFound("Claim");
  return { ok: true };
}
