import { Router } from "express";
import { countSchema, priceUpdateSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as stock from "./service";

export const stockRoutes = Router();
stockRoutes.post("/counts", requirePermission("stock.count"), handler((req) => {
  const { counts, note } = parse(countSchema, req.body);
  return stock.applyCounts(ctx(req), counts, note);
}));
stockRoutes.post("/prices", requirePermission("stock.count"), handler((req) => stock.setPrices(ctx(req), parse(priceUpdateSchema, req.body).prices)));
stockRoutes.get("/ledger", requirePermission("stock.view"), handler((req) =>
  stock.ledger(ctx(req).tenantId, { productId: str(req.query.productId), limit: Number(req.query.limit) || 100 }),
));
