import { Router } from "express";
import { z } from "zod";
import { checkInSchema, employeeSchema, istDateKey, leaveDecisionSchema, leaveSchema, payrollRunSchema, taskSchema, taskStatusSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { forbidden } from "../../lib/errors";
import { ctx, handler, str } from "../../lib/http";
import * as hr from "./service";
import { selfiePath } from "./selfies";
import { payslipPdf } from "./payslip-pdf";

export const employeeRoutes = Router();
employeeRoutes.get("/", requirePermission("employees.view"), handler((req) => hr.listEmployees(ctx(req).tenantId)));
employeeRoutes.get("/:id", requirePermission("employees.view"), handler((req) => hr.getEmployee(ctx(req).tenantId, String(req.params.id))));
employeeRoutes.post("/", requirePermission("employees.manage"), handler(async (req, res) => {
  res.status(201);
  return hr.createEmployee(ctx(req), parse(employeeSchema, req.body));
}));
employeeRoutes.patch("/:id", requirePermission("employees.manage"), handler((req) =>
  hr.updateEmployee(ctx(req), String(req.params.id), parse(employeeSchema.partial().extend({ active: z.boolean().optional() }), req.body)),
));

export const taskRoutes = Router();
taskRoutes.get("/", requirePermission("tasks.self", "tasks.manage"), handler((req) => hr.listTasks(ctx(req), { mine: req.query.mine === "1", status: str(req.query.status) })));
taskRoutes.post("/", requirePermission("tasks.manage"), handler(async (req, res) => {
  res.status(201);
  return hr.createTask(ctx(req), parse(taskSchema, req.body));
}));
taskRoutes.patch("/:id/status", requirePermission("tasks.self", "tasks.manage"), handler((req) => {
  const { status, note } = parse(taskStatusSchema, req.body);
  return hr.updateTaskStatus(ctx(req), String(req.params.id), status, note);
}));

export const attendanceRoutes = Router();
attendanceRoutes.get("/me", requirePermission("attendance.self"), handler((req) => hr.myToday(ctx(req))));
attendanceRoutes.post("/check-in", requirePermission("attendance.self"), handler(async (req, res) => {
  res.status(201);
  return hr.checkIn(ctx(req), parse(checkInSchema, req.body));
}));
attendanceRoutes.post("/check-out", requirePermission("attendance.self"), handler((req) => hr.checkOut(ctx(req), parse(checkInSchema, req.body))));
attendanceRoutes.get("/today", requirePermission("attendance.view"), handler((req) => hr.todayBoard(ctx(req).tenantId)));
attendanceRoutes.get("/month", requirePermission("attendance.view"), handler((req) =>
  hr.monthGrid(ctx(req).tenantId, str(req.query.month) ?? istDateKey().slice(0, 7)),
));
attendanceRoutes.post("/manual", requirePermission("attendance.view"), handler((req) =>
  hr.markManual(ctx(req), parse(z.object({ employeeId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["PRESENT", "LATE", "HALF_DAY", "ABSENT", "LEAVE"]) }), req.body)),
));
attendanceRoutes.get("/:id/selfie/:kind", requirePermission("attendance.view", "attendance.self"), handler(async (req, res) => {
  const c = ctx(req);
  const kind = req.params.kind === "out" ? "out" : "in";
  const { rel, employeeId } = await hr.selfieFor(c.tenantId, String(req.params.id), kind);
  if (c.role === "STAFF" && employeeId !== c.employeeId) throw forbidden();
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(selfiePath(rel));
}));

export const leaveRoutes = Router();
leaveRoutes.get("/", requirePermission("leave.self", "leave.approve"), handler((req) => hr.listLeaves(ctx(req))));
leaveRoutes.post("/", requirePermission("leave.self"), handler(async (req, res) => {
  res.status(201);
  return hr.applyLeave(ctx(req), parse(leaveSchema, req.body));
}));
leaveRoutes.patch("/:id", requirePermission("leave.approve"), handler((req) => hr.decideLeave(ctx(req), String(req.params.id), parse(leaveDecisionSchema, req.body).status)));
leaveRoutes.get("/holidays", requirePermission("leave.self", "leave.approve"), handler((req) => hr.listHolidays(ctx(req).tenantId)));
leaveRoutes.post("/holidays", requirePermission("leave.approve"), handler((req) =>
  hr.addHoliday(ctx(req), parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: z.string().trim().min(2) }), req.body)),
));

export const payrollRoutes = Router();
payrollRoutes.use(requirePermission("payroll.manage"));
payrollRoutes.get("/", handler((req) => hr.listPayslips(ctx(req).tenantId, str(req.query.month) ?? istDateKey().slice(0, 7))));
payrollRoutes.post("/run", handler((req) => {
  const { month, advances } = parse(payrollRunSchema, req.body);
  return hr.runPayroll(ctx(req), month, advances);
}));
payrollRoutes.post("/mark-paid", handler((req) => hr.markPaid(ctx(req), parse(z.object({ ids: z.array(z.string()).min(1) }), req.body).ids)));
payrollRoutes.get("/:id/pdf", handler(async (req, res) => {
  const pdf = await payslipPdf(await hr.payslipFor(ctx(req).tenantId, String(req.params.id)));
  res.type("application/pdf").setHeader("Content-Disposition", 'inline; filename="payslip.pdf"');
  res.send(pdf);
}));
