import { Router } from "express";
import { purchaseSchema, supplierSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as svc from "./service";

export const supplierRoutes = Router();
supplierRoutes.use(requirePermission("suppliers.manage", "purchases.manage"));
supplierRoutes.get("/", handler((req) => svc.listSuppliers(ctx(req).tenantId)));
supplierRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return svc.createSupplier(ctx(req), parse(supplierSchema, req.body));
}));
supplierRoutes.put("/:id", handler((req) => svc.updateSupplier(ctx(req), String(req.params.id), parse(supplierSchema, req.body))));

export const purchaseRoutes = Router();
purchaseRoutes.use(requirePermission("purchases.manage"));
purchaseRoutes.get("/", handler((req) => svc.listPurchases(ctx(req).tenantId, str(req.query.supplierId))));
purchaseRoutes.get("/:id", handler((req) => svc.getPurchase(ctx(req).tenantId, String(req.params.id))));
purchaseRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return svc.createPurchase(ctx(req), parse(purchaseSchema, req.body));
}));
