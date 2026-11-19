import { Router } from "express";
import { z } from "zod";
import { resolveRange, settingsSchema, userCreateSchema, type RangePreset } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
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
  admin.updateUser(ctx(req), String(req.params.id), parse(z.object({ active: z.boolean().optional(), resetDevice: z.boolean().optional(), password: z.string().min(8).optional() }), req.body)),
));

const rangeOf = (q: Record<string, unknown>) => {
  const d = resolveRange((str(q.preset) as Exclude<RangePreset, "custom">) ?? "month");
  return { from: str(q.from) ?? d.from, to: str(q.to) ?? d.to };
};

export const insightRoutes = Router();
insightRoutes.get("/summary", requirePermission("analytics.view"), handler((req) => insights.summary(ctx(req).tenantId, rangeOf(req.query), str(req.query.platformId))));
insightRoutes.get("/home", requirePermission("dashboard.view"), handler(async (req) => {
  const c = ctx(req);
  const [sum, attention, recent, team, buys] = await Promise.all([
    insights.summary(c.tenantId, rangeOf(req.query)),
    insights.attention(c.tenantId),
    insights.recentActivity(c.tenantId),
    todayBoard(c.tenantId),
    listTrips(c.tenantId, {}),
  ]);
  return { summary: sum, attention, recent, team: team.summary, allTimeInvestedPaise: buys.totals.totalPaise };
}));
insightRoutes.get("/notifications", handler(async (req) => (ctx(req).role === "OWNER" ? insights.attention(ctx(req).tenantId) : [])));
