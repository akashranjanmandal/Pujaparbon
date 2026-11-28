import { Router } from "express";
import { categoryRenameSchema, productSchema, productUpdateSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import { needBusiness } from "../../lib/isolation";
import * as catalog from "./service";

export const productRoutes = Router();
productRoutes.get("/", requirePermission("stock.view"), handler((req) => catalog.list(ctx(req).tenantId, { search: str(req.query.search), category: str(req.query.category), businessId: needBusiness(req.query.businessId) })));
productRoutes.get("/categories", requirePermission("stock.view"), handler((req) => catalog.categories(ctx(req).tenantId, needBusiness(req.query.businessId))));
productRoutes.post("/categories/rename", requirePermission("products.manage"), handler((req) => {
  const { from, to } = parse(categoryRenameSchema, req.body);
  return catalog.renameCategory(ctx(req), from, to, needBusiness(req.query.businessId));
}));
productRoutes.post("/", requirePermission("products.manage"), handler(async (req, res) => {
  res.status(201);
  return catalog.create(ctx(req), parse(productSchema, req.body));
}));

productRoutes.get("/:id", requirePermission("stock.view"), handler((req) => catalog.get(ctx(req).tenantId, String(req.params.id))));
productRoutes.patch("/:id", requirePermission("products.manage"), handler((req) => catalog.update(ctx(req), String(req.params.id), parse(productUpdateSchema, req.body))));
productRoutes.delete("/:id", requirePermission("products.manage"), handler((req) => catalog.archive(ctx(req), String(req.params.id))));
