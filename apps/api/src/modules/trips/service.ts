import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { allocateTrip, pctOver, tripTotals, type TripInput } from "@pp/shared";
import { db } from "../../db/client";
import { products, stockMovements, tripCosts, tripItems, trips } from "../../db/schema";
import { audit } from "../../lib/audit";
import { newProductCode, newTripCode } from "../../lib/codes";
import { badRequest, conflict, notFound } from "../../lib/errors";
import type { AuthContext } from "../../lib/http";
import { levels, recordMovement } from "../stock/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

/**
 * Saving a buy: creates any new products (the owner invents categories as he goes), spreads the trip costs over the
 * items, adds stock at landed cost, and sets the selling prices he decided on. All in one transaction.
 */
export async function create(c: Ctx, input: TripInput) {
  const id = await db.transaction(async (tx) => {
    // Resolve every line to a product, creating new ones.
    const resolved: { productId: string; qty: number; linePaise: number; unitPricePaise: number }[] = [];
    const seen = new Set<string>();
    for (const item of input.items) {
      let productId = item.productId;
      if (productId) {
        const [p] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.tenantId, c.tenantId)));
        if (!p) throw notFound("Product");
      } else {
        const np = item.newProduct!;
        const [same] = await tx.select({ id: products.id }).from(products).where(and(eq(products.tenantId, c.tenantId), eq(products.name, np.name), eq(products.category, np.category)));
        productId = same?.id;
        if (!productId) {
          [{ id: productId }] = await tx
            .insert(products)
            .values({ tenantId: c.tenantId, code: await newProductCode(tx, c.tenantId), name: np.name, category: np.category, unit: np.unit })
            .returning({ id: products.id });
        }
      }
      if (seen.has(productId!)) throw badRequest("The same product is listed twice. Combine them into one line.");
      seen.add(productId!);
      resolved.push({ productId: productId!, qty: item.qty, linePaise: item.linePaise, unitPricePaise: item.unitPricePaise });
    }

    const lines = resolved.map((r) => ({ qty: r.qty, linePaise: r.linePaise }));
    const totals = tripTotals(lines, input.costs);
    const split = allocateTrip(lines, totals.costsPaise, input.basis);

    const [trip] = await tx
      .insert(trips)
      .values({
        tenantId: c.tenantId, code: await newTripCode(tx, c.tenantId), date: input.date, title: input.title ?? null, place: input.place ?? null, notes: input.notes ?? null,
        basis: input.basis, itemsPaise: totals.itemsPaise, costsPaise: totals.costsPaise, totalPaise: totals.totalPaise, createdById: c.userId,
      })
      .returning();

    for (const cost of input.costs) {
      await tx.insert(tripCosts).values({ tripId: trip.id, kind: cost.kind, label: cost.label ?? null, amountPaise: cost.amountPaise, paidBy: cost.paidBy ?? null });
    }
    for (const [i, r] of resolved.entries()) {
      const s = split[i];
      await tx.insert(tripItems).values({
        tripId: trip.id, productId: r.productId, qty: r.qty, linePaise: r.linePaise, extraPaise: s.extraPaise, landedPaise: s.landedPaise,
        unitCostPaise: s.unitCostPaise, unitPricePaise: r.unitPricePaise,
      });
      await recordMovement(tx, c, { productId: r.productId, qty: r.qty, valuePaise: s.landedPaise, type: "BUY", refType: "trip", refId: trip.id, note: `Bought${input.place ? ` at ${input.place}` : ""}` });
      if (r.unitPricePaise > 0) await tx.update(products).set({ sellingPricePaise: r.unitPricePaise }).where(eq(products.id, r.productId));
    }
    await audit(tx, c, "trip.create", "trip", trip.id, { totalPaise: totals.totalPaise, items: resolved.length });
    return trip.id;
  });
  return get(c.tenantId, id);
}

export async function get(tenantId: string, ref: string) {
  const [trip] = await db.select().from(trips).where(and(eq(trips.tenantId, tenantId), sql`(${trips.id} = ${ref} or ${trips.code} = ${ref})`));
  if (!trip) throw notFound("Buy");
  const [items, costs] = await Promise.all([
    db
      .select({
        id: tripItems.id, productId: products.id, name: products.name, category: products.category, unit: products.unit, code: products.code, qty: tripItems.qty,
        linePaise: tripItems.linePaise, extraPaise: tripItems.extraPaise, landedPaise: tripItems.landedPaise, unitCostPaise: tripItems.unitCostPaise, unitPricePaise: tripItems.unitPricePaise,
      })
      .from(tripItems)
      .innerJoin(products, eq(products.id, tripItems.productId))
      .where(eq(tripItems.tripId, trip.id)),
    db.select().from(tripCosts).where(eq(tripCosts.tripId, trip.id)),
  ]);
  const lv = await levels(db, tenantId, items.map((i) => i.productId));
  const withStock = items.map((i) => ({ ...i, pct: pctOver(i.unitCostPaise, i.unitPricePaise), onHand: lv.get(i.productId)?.qty ?? 0 }));
  const sellValue = items.reduce((s, i) => s + i.qty * i.unitPricePaise, 0);
  return {
    ...trip, items: withStock, costs,
    expectedSalesPaise: sellValue,
    expectedProfitPaise: sellValue - trip.totalPaise,
    expectedMarginPct: pctOver(trip.totalPaise, sellValue),
  };
}

export async function list(tenantId: string, q: { from?: string; to?: string }) {
  const where = [eq(trips.tenantId, tenantId)];
  if (q.from) where.push(gte(trips.date, q.from));
  if (q.to) where.push(lte(trips.date, q.to));
  const rows = await db.select().from(trips).where(and(...where)).orderBy(desc(trips.date), desc(trips.createdAt)).limit(300);
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db.select({ tripId: tripItems.tripId, items: sql<number>`count(*)`, units: sql<number>`sum(${tripItems.qty})` }).from(tripItems).where(inArray(tripItems.tripId, ids)).groupBy(tripItems.tripId)
    : [];
  const cm = new Map(counts.map((c) => [c.tripId, c]));
  const items = rows.map((r) => ({ ...r, itemCount: Number(cm.get(r.id)?.items ?? 0), units: Number(cm.get(r.id)?.units ?? 0) }));
  return {
    items,
    totals: {
      trips: items.length,
      itemsPaise: items.reduce((s, i) => s + i.itemsPaise, 0),
      costsPaise: items.reduce((s, i) => s + i.costsPaise, 0),
      totalPaise: items.reduce((s, i) => s + i.totalPaise, 0),
    },
  };
}

/** Deleting a buy takes its stock back out. Refused if that stock has already been sold or counted away. */
export async function remove(c: Ctx, id: string) {
  await db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(and(eq(trips.id, id), eq(trips.tenantId, c.tenantId)));
    if (!trip) throw notFound("Buy");
    const items = await tx.select().from(tripItems).where(eq(tripItems.tripId, id));
    const lv = await levels(tx, c.tenantId, items.map((i) => i.productId));
    for (const i of items) {
      if ((lv.get(i.productId)?.qty ?? 0) < i.qty) throw conflict("Part of this buy has already been sold or counted away, so it cannot be deleted.");
    }
    await tx.delete(stockMovements).where(and(eq(stockMovements.refType, "trip"), eq(stockMovements.refId, id)));
    await tx.delete(tripItems).where(eq(tripItems.tripId, id));
    await tx.delete(tripCosts).where(eq(tripCosts.tripId, id));
    await tx.delete(trips).where(eq(trips.id, id));
    await audit(tx, c, "trip.delete", "trip", id, { totalPaise: trip.totalPaise });
  });
  return { ok: true };
}
