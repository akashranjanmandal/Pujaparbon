import { and, eq, inArray, isNull, like, or, type SQL } from "drizzle-orm";
import type { ProductInput } from "@pp/shared";
import { db, type Tx } from "../../db/client";
import { channelListings, channels, products, variants } from "../../db/schema";
import { badRequest, notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import type { AuthContext } from "../../lib/http";
import { committed, levels } from "../stock/service";

type Ctx = Pick<AuthContext, "tenantId" | "userId">;

async function channelIdMap(ex: Tx | typeof db, tenantId: string) {
  const rows = await ex.select({ id: channels.id, code: channels.code }).from(channels).where(eq(channels.tenantId, tenantId));
  return new Map(rows.map((r) => [r.code, r.id]));
}

export async function list(tenantId: string, q: { search?: string; category?: string }) {
  const where: SQL[] = [eq(products.tenantId, tenantId), isNull(products.deletedAt)];
  if (q.category) where.push(eq(products.category, q.category));
  if (q.search) {
    const s = `%${q.search}%`;
    const skuHits = db.select({ id: variants.productId }).from(variants).where(and(eq(variants.tenantId, tenantId), like(variants.sku, s)));
    where.push(or(like(products.name, s), like(products.category, s), inArray(products.id, skuHits))!);
  }
  const prods = await db.select().from(products).where(and(...where)).orderBy(products.name);
  if (!prods.length) return { items: [], categories: await categories(tenantId) };
  const vars = await db
    .select()
    .from(variants)
    .where(and(inArray(variants.productId, prods.map((p) => p.id)), isNull(variants.deletedAt)));
  const listings = await db
    .select({ variantId: channelListings.variantId, code: channels.code, channelSku: channelListings.channelSku, listingId: channelListings.listingId })
    .from(channelListings)
    .innerJoin(channels, eq(channels.id, channelListings.channelId))
    .where(eq(channelListings.tenantId, tenantId));
  const [lv, com] = await Promise.all([levels(db, tenantId), committed(db, tenantId)]);

  const items = prods.map((p) => {
    const pv = vars
      .filter((v) => v.productId === p.id)
      .map((v) => ({
        ...v,
        onHand: lv.get(v.id) ?? 0,
        committed: com.get(v.id) ?? 0,
        listings: listings.filter((l) => l.variantId === v.id).map(({ variantId: _v, ...l }) => l),
      }));
    const prices = pv.map((v) => v.pricePaise);
    return {
      ...p,
      variants: pv,
      onHand: pv.reduce((s, v) => s + v.onHand, 0),
      minPricePaise: Math.min(...prices),
      maxPricePaise: Math.max(...prices),
      channels: [...new Set(pv.flatMap((v) => v.listings.map((l) => l.code)))],
      lowStock: pv.some((v) => v.onHand <= v.reorderLevel),
    };
  });
  return { items, categories: await categories(tenantId) };
}

export async function categories(tenantId: string) {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), isNull(products.deletedAt)));
  return rows.map((r) => r.category).sort();
}

export async function get(tenantId: string, id: string) {
  const { items } = await list(tenantId, {});
  const p = items.find((i) => i.id === id);
  if (!p) throw notFound("Product");
  return p;
}

async function writeVariants(tx: Tx, c: Ctx, productId: string, input: ProductInput) {
  const chan = await channelIdMap(tx, c.tenantId);
  const existing = await tx.select({ id: variants.id }).from(variants).where(and(eq(variants.productId, productId), isNull(variants.deletedAt)));
  const keep = new Set(input.variants.map((v) => v.id).filter(Boolean));
  for (const old of existing) {
    if (!keep.has(old.id)) await tx.update(variants).set({ deletedAt: new Date() }).where(eq(variants.id, old.id));
  }
  for (const v of input.variants) {
    const values = {
      sku: v.sku.toUpperCase(), size: v.size ?? null, color: v.color ?? null, mrpPaise: v.mrpPaise,
      pricePaise: v.pricePaise, costPaise: v.costPaise, reorderLevel: v.reorderLevel,
    };
    if (v.pricePaise > v.mrpPaise) throw badRequest(`${v.sku}: selling price is above MRP`);
    let variantId = v.id;
    if (variantId) {
      await tx.update(variants).set(values).where(and(eq(variants.id, variantId), eq(variants.tenantId, c.tenantId)));
    } else {
      [{ id: variantId }] = await tx.insert(variants).values({ ...values, tenantId: c.tenantId, productId }).returning({ id: variants.id });
    }
    await tx.delete(channelListings).where(eq(channelListings.variantId, variantId!));
    for (const l of v.listings) {
      const channelId = chan.get(l.channel);
      if (!channelId) throw badRequest(`Unknown channel ${l.channel}`);
      await tx.insert(channelListings).values({ tenantId: c.tenantId, variantId: variantId!, channelId, channelSku: l.channelSku, listingId: l.listingId ?? null });
    }
  }
}

export async function create(c: Ctx, input: ProductInput) {
  const id = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(products)
      .values({ tenantId: c.tenantId, name: input.name, category: input.category, description: input.description ?? null, hsnCode: input.hsnCode, gstRate: input.gstRate, emoji: input.emoji ?? null })
      .returning({ id: products.id });
    await writeVariants(tx, c, p.id, input);
    await audit(tx, c, "product.create", "product", p.id, { name: input.name });
    return p.id;
  });
  return get(c.tenantId, id);
}

export async function update(c: Ctx, id: string, input: ProductInput) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, id), eq(products.tenantId, c.tenantId), isNull(products.deletedAt)));
    if (!p) throw notFound("Product");
    await tx
      .update(products)
      .set({ name: input.name, category: input.category, description: input.description ?? null, hsnCode: input.hsnCode, gstRate: input.gstRate, emoji: input.emoji ?? null })
      .where(eq(products.id, id));
    await writeVariants(tx, c, id, input);
    await audit(tx, c, "product.update", "product", id);
  });
  return get(c.tenantId, id);
}

export async function remove(c: Ctx, id: string) {
  await db.transaction(async (tx) => {
    const res = await tx.update(products).set({ deletedAt: new Date() }).where(and(eq(products.id, id), eq(products.tenantId, c.tenantId)));
    if (!res.rowsAffected) throw notFound("Product");
    await tx.update(variants).set({ deletedAt: new Date() }).where(eq(variants.productId, id));
    await audit(tx, c, "product.delete", "product", id);
  });
  return { ok: true };
}

/** Resolve the variants for a label sheet. */
export async function labelData(tenantId: string, variantIds: string[]) {
  return db
    .select({ id: variants.id, sku: variants.sku, size: variants.size, color: variants.color, mrpPaise: variants.mrpPaise, name: products.name })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(variants.tenantId, tenantId), inArray(variants.id, variantIds)));
}
