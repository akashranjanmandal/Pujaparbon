import { and, eq, inArray } from "drizzle-orm";
import type { Executor } from "../db/client";
import { businesses, locations, parties, platforms, products } from "../db/schema";
import { badRequest } from "./errors";

/**
 * The businesses are kept completely apart: every record belongs to exactly one business, and nothing may point at
 * a record of another business. Only money (accounts and fund transfers) is ever combined.
 */

/** A list or a create must say which business it is for. */
export function needBusiness(id: unknown): string {
  if (typeof id !== "string" || !id) throw badRequest("Choose a business first");
  return id;
}

export async function requireBusiness(ex: Executor, tenantId: string, id: string | null | undefined) {
  const bid = needBusiness(id);
  const [b] = await ex.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.id, bid), eq(businesses.tenantId, tenantId)));
  if (!b) throw badRequest("Unknown business");
  return bid;
}

const other = (what: string) => badRequest(`${what} belongs to a different business`);

export async function productsIn(ex: Executor, tenantId: string, businessId: string, ids: string[]) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return;
  const rows = await ex.select({ id: products.id, name: products.name, businessId: products.businessId }).from(products).where(and(eq(products.tenantId, tenantId), inArray(products.id, uniq)));
  if (rows.length !== uniq.length) throw badRequest("Unknown product");
  const bad = rows.find((r) => r.businessId !== businessId);
  if (bad) throw other(`"${bad.name}"`);
}

export async function placeIn(ex: Executor, tenantId: string, businessId: string, id: string | null | undefined) {
  if (!id) return;
  const [l] = await ex.select({ b: locations.businessId, name: locations.name }).from(locations).where(and(eq(locations.id, id), eq(locations.tenantId, tenantId)));
  if (!l) throw badRequest("Unknown place");
  if (l.b !== businessId) throw other(`"${l.name}"`);
}

export async function partyIn(ex: Executor, tenantId: string, businessId: string, id: string | null | undefined) {
  if (!id) return null;
  const [p] = await ex.select().from(parties).where(and(eq(parties.id, id), eq(parties.tenantId, tenantId)));
  if (!p) throw badRequest("Unknown customer or supplier");
  if (p.businessId !== businessId) throw other(`"${p.name}"`);
  return p;
}

export async function platformIn(ex: Executor, tenantId: string, businessId: string, id: string | null | undefined) {
  if (!id) return null;
  const [p] = await ex.select().from(platforms).where(and(eq(platforms.id, id), eq(platforms.tenantId, tenantId)));
  if (!p) throw badRequest("Unknown platform");
  if (p.businessId !== businessId) throw other(`"${p.name}"`);
  return p;
}
