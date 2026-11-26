import { Router } from "express";
import { z } from "zod";
import { checkInSchema, employeeSchema, istDateKey, manualAttendanceSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { forbidden } from "../../lib/errors";
import { ctx, handler, str } from "../../lib/http";
import * as hr from "./service";

export const employeeRoutes = Router();
employeeRoutes.use(requirePermission("employees.manage"));
employeeRoutes.get("/", handler((req) => hr.listEmployees(ctx(req).tenantId)));
employeeRoutes.get("/:id", handler((req) => hr.getEmployee(ctx(req).tenantId, String(req.params.id))));
employeeRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return hr.createEmployee(ctx(req), parse(employeeSchema, req.body));
}));
employeeRoutes.patch("/:id", handler((req) => hr.updateEmployee(ctx(req), String(req.params.id), parse(employeeSchema.partial().extend({ active: z.boolean().optional() }), req.body))));

export const attendanceRoutes = Router();
attendanceRoutes.get("/me", requirePermission("attendance.self"), handler((req) => hr.myToday(ctx(req))));
attendanceRoutes.post("/check-in", requirePermission("attendance.self"), handler(async (req, res) => {
  res.status(201);
  return hr.checkIn(ctx(req), parse(checkInSchema, req.body));
}));
attendanceRoutes.post("/check-out", requirePermission("attendance.self"), handler((req) => hr.checkOut(ctx(req), parse(checkInSchema, req.body))));
attendanceRoutes.get("/payroll", requirePermission("payroll.manage"), handler((req) => hr.payroll(ctx(req).tenantId, str(req.query.month) ?? istDateKey().slice(0, 7))));
attendanceRoutes.get("/today", requirePermission("attendance.view"), handler((req) => hr.todayBoard(ctx(req).tenantId)));
attendanceRoutes.get("/month", requirePermission("attendance.view"), handler((req) => hr.monthGrid(ctx(req).tenantId, str(req.query.month) ?? istDateKey().slice(0, 7))));
attendanceRoutes.post("/manual", requirePermission("attendance.view"), handler((req) => hr.markManual(ctx(req), parse(manualAttendanceSchema, req.body))));
attendanceRoutes.get("/:id/selfie/:kind", requirePermission("attendance.view"), handler(async (req, res) => {
  const c = ctx(req);
  if (c.role !== "OWNER") throw forbidden();
  const buf = await hr.photoFor(c.tenantId, String(req.params.id), req.params.kind === "out" ? "out" : "in");
  res.type("image/jpeg").setHeader("Cache-Control", "private, max-age=3600");
  res.send(buf);
}));
