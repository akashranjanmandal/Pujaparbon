import { Router } from "express";
import { z } from "zod";
import { settingsSchema, userCreateSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as admin from "./service";
import * as insights from "../insights/service";

export const settingsRoutes = Router();
settingsRoutes.get("/", requirePermission("dashboard.view"), handler((req) => admin.getSettings(ctx(req).tenantId)));
settingsRoutes.put("/", requirePermission("settings.manage"), handler((req) => admin.updateSettings(ctx(req), parse(settingsSchema, req.body))));
settingsRoutes.get("/audit", requirePermission("settings.manage"), handler((req) => admin.auditTrail(ctx(req).tenantId)));

export const userRoutes = Router();
userRoutes.use(requirePermission("users.manage"));
userRoutes.get("/", handler((req) => admin.listUsers(ctx(req).tenantId)));
userRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return admin.createUser(ctx(req), parse(userCreateSchema, req.body));
}));
userRoutes.patch("/:id", handler((req) =>
  admin.updateUser(ctx(req), String(req.params.id), parse(z.object({ active: z.boolean().optional(), resetDevice: z.boolean().optional(), password: z.string().min(8).optional() }), req.body)),
));

export const insightRoutes = Router();
insightRoutes.get("/dashboard", requirePermission("dashboard.view"), handler((req) => insights.dashboard(ctx(req).tenantId)));
insightRoutes.get("/analytics", requirePermission("analytics.view"), handler((req) => insights.analytics(ctx(req).tenantId)));
insightRoutes.get("/search", requirePermission("dashboard.view"), handler((req) => {
  const q = str(req.query.q);
  return q && q.length >= 2 ? insights.search(ctx(req).tenantId, q) : { products: [], orders: [], employees: [], suppliers: [] };
}));
insightRoutes.get("/notifications", requirePermission("dashboard.view"), handler((req) => insights.notifications(ctx(req).tenantId, ctx(req).role)));
