import { Router } from "express";
import { can } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { notFound } from "../../lib/errors";
import { ctx, handler } from "../../lib/http";
import * as catalog from "./service";
import * as trips from "../trips/service";

/**
 * What a scanned QR code shows. The owner sees costs and prices; an employee only sees what the item is and how many are in stock.
 */
export const lookupRoutes = Router();
lookupRoutes.get("/:code", requirePermission("lookup.scan"), handler(async (req) => {
  const c = ctx(req);
  const code = String(req.params.code).toUpperCase().trim();
  const money = can(c.role, "stock.view");
  if (code.startsWith("P")) {
    const p = await catalog.get(c.tenantId, code).catch(() => null);
    if (!p) throw notFound("Code");
    return money
      ? { type: "PRODUCT", money, product: p }
      : { type: "PRODUCT", money, product: { id: p.id, code: p.code, name: p.name, category: p.category, unit: p.unit, onHand: p.onHand, lastCountAt: p.lastCountAt } };
  }
  if (code.startsWith("L") && money) {
    const t = await trips.get(c.tenantId, code).catch(() => null);
    if (!t) throw notFound("Code");
    return { type: "LOT", money, trip: t };
  }
  throw notFound("Code");
}));
