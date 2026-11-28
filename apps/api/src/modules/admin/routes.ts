import { Router } from "express";
import { z } from "zod";
import { resolveRange, roleSchema, settingsSchema, userCreateSchema, type RangePreset } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { needBusiness } from "../../lib/isolation";
import { ctx, handler, str } from "../../lib/http";
import * as admin from "./service";
import * as insights from "../insights/service";
import { todayBoard } from "../hr/service";
import { list as listTrips } from "../trips/service";

export const settingsRoutes = Router();
settingsRoutes.get("/", requirePermission("settings.manage"), handler((req) => admin.getSettings(ctx(req).tenantId)));
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
  admin.updateUser(ctx(req), String(req.params.id), parse(z.object({ active: z.boolean().optional(), resetDevice: z.boolean().optional(), password: z.string().min(8).optional(), roleId: z.string().nullable().optional() }), req.body)),
));

export const roleRoutes = Router();
roleRoutes.use(requirePermission("users.manage"));
roleRoutes.get("/", handler((req) => admin.listRoles(ctx(req).tenantId)));
roleRoutes.post("/", handler(async (req, res) => { res.status(201); return admin.saveRole(ctx(req), parse(roleSchema, req.body)); }));
roleRoutes.put("/:id", handler((req) => admin.saveRole(ctx(req), parse(roleSchema, req.body), String(req.params.id))));
roleRoutes.delete("/:id", handler((req) => admin.deleteRole(ctx(req), String(req.params.id))));

const rangeOf = (q: Record<string, unknown>) => {
  const d = resolveRange((str(q.preset) as Exclude<RangePreset, "custom">) ?? "month");
  return { from: str(q.from) ?? d.from, to: str(q.to) ?? d.to };
};

export const insightRoutes = Router();
insightRoutes.get("/summary", requirePermission("analytics.view"), handler((req) => insights.summary(ctx(req).tenantId, rangeOf(req.query), str(req.query.platformId), needBusiness(req.query.businessId))));
insightRoutes.get("/home", requirePermission("dashboard.view"), handler(async (req) => {
  const c = ctx(req);
  const biz = needBusiness(req.query.businessId);
  const [sum, attention, recent, team, buys] = await Promise.all([
    insights.summary(c.tenantId, rangeOf(req.query), undefined, biz),
    insights.attention(c.tenantId, biz),
    insights.recentActivity(c.tenantId, biz),
    todayBoard(c.tenantId),
    listTrips(c.tenantId, { businessId: biz }),
  ]);
  return { summary: sum, attention, recent, team: team.summary, allTimeInvestedPaise: buys.totals.totalPaise };
}));
insightRoutes.get("/notifications", handler(async (req) => (ctx(req).role === "OWNER" && str(req.query.businessId) ? insights.attention(ctx(req).tenantId, str(req.query.businessId)) : [])));
