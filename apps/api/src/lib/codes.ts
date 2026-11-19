import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { products, trips } from "../db/schema";

/** No 0/O/1/I so codes survive being read aloud or printed small. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const random = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");

export async function newProductCode(ex: Executor, tenantId: string) {
  for (;;) {
    const code = `P${random()}`;
    const [hit] = await ex.select({ id: products.id }).from(products).where(and(eq(products.tenantId, tenantId), eq(products.code, code)));
    if (!hit) return code;
  }
}

export async function newTripCode(ex: Executor, tenantId: string) {
  for (;;) {
    const code = `L${random()}`;
    const [hit] = await ex.select({ id: trips.id }).from(trips).where(and(eq(trips.tenantId, tenantId), eq(trips.code, code)));
    if (!hit) return code;
  }
}
