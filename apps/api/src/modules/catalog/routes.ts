import { Router } from "express";
import { z } from "zod";
import { categoryRenameSchema, productSchema, productUpdateSchema } from "@pp/shared";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { tenants } from "../../db/schema";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { badRequest } from "../../lib/errors";
import { ctx, handler, str } from "../../lib/http";
import * as catalog from "./service";
import * as tripSvc from "../trips/service";
import { labelSheetPdf, type QrLabel } from "./labels";

export const productRoutes = Router();
productRoutes.get("/", requirePermission("stock.view"), handler((req) => catalog.list(ctx(req).tenantId, { search: str(req.query.search), category: str(req.query.category) })));
productRoutes.get("/categories", requirePermission("stock.view"), handler((req) => catalog.categories(ctx(req).tenantId)));
productRoutes.post("/categories/rename", requirePermission("products.manage"), handler((req) => {
  const { from, to } = parse(categoryRenameSchema, req.body);
  return catalog.renameCategory(ctx(req), from, to);
}));
productRoutes.post("/", requirePermission("products.manage"), handler(async (req, res) => {
  res.status(201);
  return catalog.create(ctx(req), parse(productSchema, req.body));
}));

/** QR label sheets for products and/or whole lots. */
productRoutes.post("/labels", requirePermission("stock.view"), handler(async (req, res) => {
  const { productIds, tripIds, copies, baseUrl } = parse(
    z.object({ productIds: z.array(z.string()).max(200).default([]), tripIds: z.array(z.string()).max(50).default([]), copies: z.number().int().min(1).max(20).default(1), baseUrl: z.string().url() }),
    req.body,
  );
  if (!productIds.length && !tripIds.length) throw badRequest("Choose something to print");
  const c = ctx(req);
  const labels: QrLabel[] = [];
  for (const id of productIds) {
    const p = await catalog.get(c.tenantId, id);
    for (let i = 0; i < copies; i++) labels.push({ code: p.code, title: p.name, subtitle: p.category, price: p.sellingPricePaise });
  }
  for (const id of tripIds) {
    const t = await tripSvc.get(c.tenantId, id);
    for (let i = 0; i < copies; i++) labels.push({ code: t.code, title: t.title || t.place || "Buy", subtitle: `${t.date} · ${t.items.length} items`, price: undefined });
  }
  const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, c.tenantId));
  res.type("application/pdf").setHeader("Content-Disposition", 'inline; filename="qr-labels.pdf"');
  res.send(await labelSheetPdf(labels, baseUrl, t?.name ?? "Pujo Parbon"));
}));

productRoutes.get("/:id", requirePermission("stock.view"), handler((req) => catalog.get(ctx(req).tenantId, String(req.params.id))));
productRoutes.patch("/:id", requirePermission("products.manage"), handler((req) => catalog.update(ctx(req), String(req.params.id), parse(productUpdateSchema, req.body))));
productRoutes.delete("/:id", requirePermission("products.manage"), handler((req) => catalog.archive(ctx(req), String(req.params.id))));
