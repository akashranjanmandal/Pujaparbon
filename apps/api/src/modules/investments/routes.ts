import { Router } from "express";
import { investmentSchema, resolveRange } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as svc from "./service";

export const investmentRoutes = Router();
investmentRoutes.use(requirePermission("investments.manage"));
investmentRoutes.get("/", handler((req) => {
  const d = resolveRange("month");
  return svc.overview(ctx(req).tenantId, { from: str(req.query.from) ?? d.from, to: str(req.query.to) ?? d.to }, str(req.query.businessId));
}));
investmentRoutes.get("/categories", handler((req) => svc.categories(ctx(req).tenantId)));
investmentRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return svc.create(ctx(req), parse(investmentSchema, req.body));
}));
investmentRoutes.put("/:id", handler((req) => svc.update(ctx(req), String(req.params.id), parse(investmentSchema, req.body))));
investmentRoutes.delete("/:id", handler((req) => svc.remove(ctx(req), String(req.params.id))));
