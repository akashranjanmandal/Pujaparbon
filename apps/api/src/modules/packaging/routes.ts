import { Router } from "express";
import { materialSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler } from "../../lib/http";
import { needBusiness } from "../../lib/isolation";
import * as svc from "./service";

export const packagingRoutes = Router();
packagingRoutes.get("/", requirePermission("packaging.view"), handler((req) => svc.overview(ctx(req).tenantId, needBusiness(req.query.businessId))));
packagingRoutes.post("/materials", requirePermission("packaging.manage"), handler(async (req, res) => { res.status(201); return svc.addMaterial(ctx(req), parse(materialSchema, req.body)); }));
packagingRoutes.patch("/materials/:id", requirePermission("packaging.manage"), handler((req) => svc.updateMaterial(ctx(req), String(req.params.id), parse(materialSchema.omit({ businessId: true }).partial(), req.body))));
packagingRoutes.delete("/materials/:id", requirePermission("packaging.manage"), handler((req) => svc.removeMaterial(ctx(req), String(req.params.id))));
