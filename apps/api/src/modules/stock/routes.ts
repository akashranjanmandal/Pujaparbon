import { Router } from "express";
import { binSchema, stockMoveSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { forbidden } from "../../lib/errors";
import { ctx, handler, str } from "../../lib/http";
import * as stock from "./service";

export const stockRoutes = Router();

stockRoutes.get("/", requirePermission("stock.view"), handler((req) =>
  stock.list(ctx(req).tenantId, { search: str(req.query.search), category: str(req.query.category), filter: str(req.query.filter) as "low" }),
));
stockRoutes.get("/ledger", requirePermission("stock.view"), handler((req) =>
  stock.ledger(ctx(req).tenantId, { variantId: str(req.query.variantId), type: str(req.query.type), limit: Number(req.query.limit) || 100 }),
));
stockRoutes.post("/moves", requirePermission("stock.move"), handler(async (req, res) => {
  const input = parse(stockMoveSchema, req.body);
  // Staff can receive and send out stock, but only managers correct counts.
  if (input.type === "ADJUSTMENT" && !req.auth!.role.match(/OWNER|MANAGER/)) throw forbidden("Only managers can adjust stock");
  res.status(201);
  return stock.move(ctx(req), input);
}));
stockRoutes.get("/bins", requirePermission("stock.view"), handler((req) => stock.listBins(ctx(req).tenantId)));
stockRoutes.post("/bins", requirePermission("stock.adjust"), handler(async (req, res) => {
  res.status(201);
  return stock.createBin(ctx(req), parse(binSchema, req.body));
}));
