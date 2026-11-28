import { Router } from "express";
import { businessSchema, locationSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler } from "../../lib/http";
import * as svc from "./service";

/** Anyone who can see stock can pick a business or place; only settings.manage changes them. */
export const businessRoutes = Router();
businessRoutes.get("/", requirePermission("stock.view"), handler((req) => svc.listBusinesses(ctx(req).tenantId)));
businessRoutes.post("/", requirePermission("settings.manage"), handler(async (req, res) => { res.status(201); return svc.createBusiness(ctx(req), parse(businessSchema, req.body)); }));
businessRoutes.patch("/:id", requirePermission("settings.manage"), handler((req) => svc.updateBusiness(ctx(req), String(req.params.id), parse(businessSchema.partial(), req.body))));

export const locationRoutes = Router();
locationRoutes.get("/", requirePermission("stock.view"), handler((req) => svc.listLocations(ctx(req).tenantId)));
locationRoutes.post("/", requirePermission("settings.manage"), handler(async (req, res) => { res.status(201); return svc.createLocation(ctx(req), parse(locationSchema, req.body)); }));
locationRoutes.patch("/:id", requirePermission("settings.manage"), handler((req) => svc.updateLocation(ctx(req), String(req.params.id), parse(locationSchema.partial(), req.body))));
