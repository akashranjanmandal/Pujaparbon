import { Router } from "express";
import { z } from "zod";
import { productSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as products from "./service";
import { labelSheetPdf } from "./labels";

export const productRoutes = Router();

productRoutes.get("/", requirePermission("products.view"), handler((req) =>
  products.list(ctx(req).tenantId, { search: str(req.query.search), category: str(req.query.category) }),
));
productRoutes.get("/:id", requirePermission("products.view"), handler((req) => products.get(ctx(req).tenantId, String(req.params.id))));
productRoutes.post("/", requirePermission("products.manage"), handler(async (req, res) => {
  res.status(201);
  return products.create(ctx(req), parse(productSchema, req.body));
}));
productRoutes.put("/:id", requirePermission("products.manage"), handler((req) =>
  products.update(ctx(req), String(req.params.id), parse(productSchema, req.body)),
));
productRoutes.delete("/:id", requirePermission("products.manage"), handler((req) => products.remove(ctx(req), String(req.params.id))));

productRoutes.post("/labels", requirePermission("products.view"), handler(async (req, res) => {
  const { variantIds, copies } = parse(z.object({ variantIds: z.array(z.string()).min(1).max(200), copies: z.number().int().min(1).max(50).default(1) }), req.body);
  const pdf = await labelSheetPdf(await products.labelData(ctx(req).tenantId, variantIds), copies);
  res.type("application/pdf").setHeader("Content-Disposition", 'inline; filename="labels.pdf"');
  res.send(pdf);
}));
