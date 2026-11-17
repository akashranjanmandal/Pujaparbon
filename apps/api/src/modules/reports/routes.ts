import { Router } from "express";
import { can, istDateKey } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { forbidden, notFound } from "../../lib/errors";
import { ctx, handler, str } from "../../lib/http";
import { db } from "../../db/client";
import { tenants } from "../../db/schema";
import { eq } from "drizzle-orm";
import { REPORTS, build, toPdf, toXlsx } from "./service";

export const reportRoutes = Router();
reportRoutes.use(requirePermission("reports.view", "payroll.manage"));

reportRoutes.get("/", handler((req) =>
  Object.entries(REPORTS).filter(([, r]) => can(ctx(req).role, r.permission)).map(([key, r]) => ({ key, ...r })),
));

reportRoutes.get("/:type", handler(async (req, res) => {
  const c = ctx(req);
  const type = String(req.params.type);
  const def = REPORTS[type];
  if (!def) throw notFound("Report");
  if (!can(c.role, def.permission)) throw forbidden();
  const today = istDateKey();
  const range = { from: str(req.query.from) ?? `${today.slice(0, 7)}-01`, to: str(req.query.to) ?? today };
  const rep = await build(c.tenantId, type, range);
  const format = str(req.query.format) ?? "json";
  const name = `pujaparbon-${type}-${range.from}-to-${range.to}`;
  if (format === "xlsx") {
    const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, c.tenantId));
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").setHeader("Content-Disposition", `attachment; filename="${name}.xlsx"`);
    return void res.send(await toXlsx(rep, t?.name ?? "Puja Parbon", def.ranged ? range : undefined));
  }
  if (format === "pdf") {
    res.type("application/pdf").setHeader("Content-Disposition", `attachment; filename="${name}.pdf"`);
    return void res.send(await toPdf(rep, c.tenantId, def.ranged ? range : undefined));
  }
  return { ...rep, range: def.ranged ? range : null };
}));
