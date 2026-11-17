import { and, between, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  attendanceStatus, checkGeofence, computePayslip, istDateKey, workingDaysInMonth,
  type CheckInInput, type EmployeeInput, type LeaveInput, type TaskInput,
} from "@pp/shared";
import { db } from "../../db/client";
import { attendance, employees, holidays, leaves, payslips, tasks, tenants, users } from "../../db/schema";
import { AppError, badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import type { AuthContext } from "../../lib/http";
import { saveSelfie } from "./selfies";

type Ctx = AuthContext;

/* ----------------------------- Employees ----------------------------- */

export async function listEmployees(tenantId: string) {
  const today = istDateKey();
  const rows = await db
    .select({
      e: employees,
      todayStatus: attendance.status,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      openTasks: sql<number>`(select count(*) from tasks t where t.employee_id = ${employees.id} and t.status != 'DONE')`,
      hasLogin: sql<number>`(select count(*) from users u where u.employee_id = ${employees.id})`,
    })
    .from(employees)
    .leftJoin(attendance, and(eq(attendance.employeeId, employees.id), eq(attendance.date, today)))
    .where(eq(employees.tenantId, tenantId))
    .orderBy(desc(employees.active), employees.name);
  return rows.map((r) => ({ ...r.e, todayStatus: r.todayStatus, checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, openTasks: Number(r.openTasks), hasLogin: Number(r.hasLogin) > 0 }));
}

export async function getEmployee(tenantId: string, id: string) {
  const [e] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)));
  if (!e) throw notFound("Employee");
  const month = istDateKey().slice(0, 7);
  const [att, taskRows, leaveRows] = await Promise.all([
    db.select().from(attendance).where(and(eq(attendance.employeeId, id), gte(attendance.date, `${month}-01`))).orderBy(attendance.date),
    db.select().from(tasks).where(eq(tasks.employeeId, id)).orderBy(desc(tasks.createdAt)).limit(30),
    db.select().from(leaves).where(eq(leaves.employeeId, id)).orderBy(desc(leaves.createdAt)).limit(20),
  ]);
  return { ...e, attendance: att, tasks: taskRows, leaves: leaveRows };
}

export async function createEmployee(c: Ctx, input: EmployeeInput) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(employees).where(eq(employees.tenantId, c.tenantId));
  const [row] = await db
    .insert(employees)
    .values({ ...input, tenantId: c.tenantId, code: `PP-E${String(Number(n) + 1).padStart(3, "0")}`, avatarHue: Math.floor(Math.random() * 360) })
    .returning();
  await audit(db, c, "employee.create", "employee", row.id);
  return row;
}

export async function updateEmployee(c: Ctx, id: string, input: Partial<EmployeeInput> & { active?: boolean }) {
  const [row] = await db.update(employees).set(input).where(and(eq(employees.id, id), eq(employees.tenantId, c.tenantId))).returning();
  if (!row) throw notFound("Employee");
  if (input.active === false) await db.update(users).set({ active: false }).where(eq(users.employeeId, id));
  await audit(db, c, "employee.update", "employee", id);
  return row;
}

/* ------------------------------- Tasks ------------------------------- */

export async function listTasks(c: Ctx, q: { mine?: boolean; status?: string }) {
  const where = [eq(tasks.tenantId, c.tenantId)];
  if (q.mine || c.role === "STAFF") {
    if (!c.employeeId) return [];
    where.push(eq(tasks.employeeId, c.employeeId));
  }
  if (q.status) where.push(eq(tasks.status, q.status as "TODO"));
  const rows = await db
    .select({ t: tasks, employeeName: employees.name, avatarHue: employees.avatarHue })
    .from(tasks)
    .innerJoin(employees, eq(employees.id, tasks.employeeId))
    .where(and(...where))
    .orderBy(tasks.status, tasks.dueDate)
    .limit(300);
  return rows.map((r) => ({ ...r.t, employeeName: r.employeeName, avatarHue: r.avatarHue }));
}

export async function createTask(c: Ctx, input: TaskInput) {
  const [e] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, c.tenantId)));
  if (!e) throw notFound("Employee");
  const [row] = await db.insert(tasks).values({ ...input, description: input.description ?? null, tenantId: c.tenantId, createdById: c.userId }).returning();
  return row;
}

export async function updateTaskStatus(c: Ctx, id: string, status: "TODO" | "IN_PROGRESS" | "DONE", note?: string) {
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.tenantId, c.tenantId)));
  if (!t) throw notFound("Task");
  if (c.role === "STAFF" && t.employeeId !== c.employeeId) throw forbidden("This task is assigned to someone else");
  const [row] = await db
    .update(tasks)
    .set({ status, note: note ?? t.note, completedAt: status === "DONE" ? new Date() : null })
    .where(eq(tasks.id, id))
    .returning();
  return row;
}

/* ----------------------------- Attendance ---------------------------- */

async function tenantRow(tenantId: string) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!t) throw notFound("Business");
  return t;
}

/** The phone a staff member first checks in from becomes their registered device. */
async function verifyDevice(c: Ctx, deviceId: string) {
  const [u] = await db.select({ deviceId: users.deviceId }).from(users).where(eq(users.id, c.userId));
  if (!u?.deviceId) {
    await db.update(users).set({ deviceId }).where(eq(users.id, c.userId));
    return;
  }
  if (u.deviceId !== deviceId) {
    throw new AppError(403, "DEVICE_MISMATCH", "This phone is not your registered device. Ask your manager to reset it.");
  }
}

export async function myToday(c: Ctx) {
  if (!c.employeeId) return { employee: null, record: null, fence: null };
  const t = await tenantRow(c.tenantId);
  const [e] = await db.select().from(employees).where(eq(employees.id, c.employeeId));
  const [record] = await db.select().from(attendance).where(and(eq(attendance.employeeId, c.employeeId), eq(attendance.date, istDateKey())));
  const month = istDateKey().slice(0, 7);
  const monthRows = await db.select({ status: attendance.status }).from(attendance).where(and(eq(attendance.employeeId, c.employeeId), gte(attendance.date, `${month}-01`)));
  return {
    employee: e ?? null,
    record: record ?? null,
    fence: { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM, shiftStart: e?.shiftStart ?? t.shiftStart, shiftEnd: t.shiftEnd, graceMin: t.lateGraceMin, name: t.name },
    month: {
      present: monthRows.filter((r) => r.status === "PRESENT").length,
      late: monthRows.filter((r) => r.status === "LATE").length,
      leave: monthRows.filter((r) => r.status === "LEAVE").length,
    },
  };
}

export async function checkIn(c: Ctx, input: CheckInInput, now = new Date()) {
  if (!c.employeeId) throw badRequest("Your login is not linked to an employee record");
  const t = await tenantRow(c.tenantId);
  const fence = checkGeofence(input, { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM });
  if (!fence.allowed) {
    throw new AppError(403, fence.reason, fence.reason === "LOW_ACCURACY"
      ? `Location is too imprecise (±${Math.round(input.accuracyM)} m). Step near a window or turn on precise location.`
      : `You are ${fence.distanceM} m from the warehouse. Check-in works within ${t.geofenceRadiusM} m.`, { distanceM: fence.distanceM });
  }
  await verifyDevice(c, input.deviceId);
  const date = istDateKey(now);
  const [existing] = await db.select().from(attendance).where(and(eq(attendance.employeeId, c.employeeId), eq(attendance.date, date)));
  if (existing?.checkInAt) throw conflict("You have already checked in today");
  const [e] = await db.select({ shiftStart: employees.shiftStart }).from(employees).where(eq(employees.id, c.employeeId));
  const status = attendanceStatus(now, e?.shiftStart ?? t.shiftStart, t.lateGraceMin);

  const id = existing?.id ?? crypto.randomUUID();
  const selfie = await saveSelfie(c.tenantId, date, id, "in", input.selfie);
  const values = { status, checkInAt: now, checkInDistanceM: fence.distanceM, checkInSelfie: selfie, deviceId: input.deviceId, source: "GEOFENCE" as const };
  const [row] = existing
    ? await db.update(attendance).set(values).where(eq(attendance.id, id)).returning()
    : await db.insert(attendance).values({ id, tenantId: c.tenantId, employeeId: c.employeeId, date, ...values }).returning();
  await audit(db, c, "attendance.check_in", "attendance", row.id, { distanceM: fence.distanceM, status });
  return row;
}

export async function checkOut(c: Ctx, input: CheckInInput, now = new Date()) {
  if (!c.employeeId) throw badRequest("Your login is not linked to an employee record");
  const t = await tenantRow(c.tenantId);
  const fence = checkGeofence(input, { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM });
  if (!fence.allowed) throw new AppError(403, fence.reason, `You are ${fence.distanceM} m from the warehouse. Check-out works within ${t.geofenceRadiusM} m.`);
  await verifyDevice(c, input.deviceId);
  const date = istDateKey(now);
  const [rec] = await db.select().from(attendance).where(and(eq(attendance.employeeId, c.employeeId), eq(attendance.date, date)));
  if (!rec?.checkInAt) throw conflict("Check in first");
  if (rec.checkOutAt) throw conflict("You have already checked out today");
  const selfie = await saveSelfie(c.tenantId, date, rec.id, "out", input.selfie);
  const [row] = await db.update(attendance).set({ checkOutAt: now, checkOutDistanceM: fence.distanceM, checkOutSelfie: selfie }).where(eq(attendance.id, rec.id)).returning();
  return row;
}

/** Live board: everyone, with today's state. Approved leave shows as LEAVE; no record after shift start is ABSENT. */
export async function todayBoard(tenantId: string, now = new Date()) {
  const date = istDateKey(now);
  const t = await tenantRow(tenantId);
  const [emps, recs, onLeave] = await Promise.all([
    db.select().from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.active, true))).orderBy(employees.name),
    db.select().from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, date))),
    db.select({ employeeId: leaves.employeeId }).from(leaves).where(and(eq(leaves.tenantId, tenantId), eq(leaves.status, "APPROVED"), lte(leaves.from, date), gte(leaves.to, date))),
  ]);
  const leaveSet = new Set(onLeave.map((l) => l.employeeId));
  const items = emps.map((e) => {
    const r = recs.find((x) => x.employeeId === e.id);
    const state = r?.status ?? (leaveSet.has(e.id) ? "LEAVE" : "NOT_IN");
    return { employee: { id: e.id, name: e.name, code: e.code, designation: e.designation, avatarHue: e.avatarHue }, record: r ?? null, state };
  });
  return {
    date,
    fence: { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM },
    items,
    summary: {
      total: items.length,
      present: items.filter((i) => i.state === "PRESENT").length,
      late: items.filter((i) => i.state === "LATE").length,
      leave: items.filter((i) => i.state === "LEAVE").length,
      notIn: items.filter((i) => i.state === "NOT_IN" || i.state === "ABSENT").length,
      checkedOut: items.filter((i) => i.record?.checkOutAt).length,
    },
  };
}

export async function monthGrid(tenantId: string, month: string) {
  const [emps, recs, hols] = await Promise.all([
    db.select({ id: employees.id, name: employees.name, code: employees.code, avatarHue: employees.avatarHue }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.active, true))).orderBy(employees.name),
    db.select({ employeeId: attendance.employeeId, date: attendance.date, status: attendance.status }).from(attendance).where(and(eq(attendance.tenantId, tenantId), between(attendance.date, `${month}-01`, `${month}-31`))),
    db.select().from(holidays).where(and(eq(holidays.tenantId, tenantId), between(holidays.date, `${month}-01`, `${month}-31`))),
  ]);
  return { month, employees: emps, records: recs, holidays: hols };
}

export async function markManual(c: Ctx, input: { employeeId: string; date: string; status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE" }) {
  const [e] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, c.tenantId)));
  if (!e) throw notFound("Employee");
  const [existing] = await db.select().from(attendance).where(and(eq(attendance.employeeId, input.employeeId), eq(attendance.date, input.date)));
  const [row] = existing
    ? await db.update(attendance).set({ status: input.status, source: "MANUAL" }).where(eq(attendance.id, existing.id)).returning()
    : await db.insert(attendance).values({ tenantId: c.tenantId, employeeId: input.employeeId, date: input.date, status: input.status, source: "MANUAL" }).returning();
  await audit(db, c, "attendance.manual", "attendance", row.id, { status: input.status });
  return row;
}

export async function selfieFor(tenantId: string, attendanceId: string, kind: "in" | "out") {
  const [r] = await db.select().from(attendance).where(and(eq(attendance.id, attendanceId), eq(attendance.tenantId, tenantId)));
  const rel = kind === "in" ? r?.checkInSelfie : r?.checkOutSelfie;
  if (!r || !rel) throw notFound("Selfie");
  return { rel, employeeId: r.employeeId };
}

/* ------------------------------- Leave ------------------------------- */

/** Leave days exclude Sundays. */
export function leaveDays(from: string, to: string) {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) n++;
  }
  return n;
}

export async function applyLeave(c: Ctx, input: LeaveInput) {
  if (!c.employeeId) throw badRequest("Your login is not linked to an employee record");
  const days = leaveDays(input.from, input.to);
  if (days === 0) throw badRequest("Those dates are all Sundays");
  const overlap = await db
    .select({ id: leaves.id })
    .from(leaves)
    .where(and(eq(leaves.employeeId, c.employeeId), inArray(leaves.status, ["PENDING", "APPROVED"]), lte(leaves.from, input.to), gte(leaves.to, input.from)));
  if (overlap.length) throw conflict("You already have leave on some of these days");
  const [row] = await db.insert(leaves).values({ ...input, tenantId: c.tenantId, employeeId: c.employeeId, days }).returning();
  return row;
}

export async function listLeaves(c: Ctx) {
  const where = [eq(leaves.tenantId, c.tenantId)];
  if (c.role === "STAFF") where.push(eq(leaves.employeeId, c.employeeId ?? "-"));
  const rows = await db
    .select({ l: leaves, employeeName: employees.name, avatarHue: employees.avatarHue })
    .from(leaves)
    .innerJoin(employees, eq(employees.id, leaves.employeeId))
    .where(and(...where))
    .orderBy(desc(leaves.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r.l, employeeName: r.employeeName, avatarHue: r.avatarHue }));
}

export async function decideLeave(c: Ctx, id: string, status: "APPROVED" | "REJECTED") {
  const [row] = await db
    .update(leaves)
    .set({ status, decidedById: c.userId })
    .where(and(eq(leaves.id, id), eq(leaves.tenantId, c.tenantId), eq(leaves.status, "PENDING")))
    .returning();
  if (!row) throw conflict("This request was already decided");
  await audit(db, c, `leave.${status.toLowerCase()}`, "leave", id);
  return row;
}

export const listHolidays = (tenantId: string) => db.select().from(holidays).where(eq(holidays.tenantId, tenantId)).orderBy(holidays.date);
export async function addHoliday(c: Ctx, input: { date: string; name: string }) {
  const [row] = await db.insert(holidays).values({ ...input, tenantId: c.tenantId }).returning();
  return row;
}

/* ------------------------------ Payroll ------------------------------ */

const overlapDays = (from: string, to: string, monthStart: string, monthEnd: string, holidaySet: Set<string>) => {
  const a = from > monthStart ? from : monthStart;
  const b = to < monthEnd ? to : monthEnd;
  if (a > b) return 0;
  let n = 0;
  for (let d = new Date(`${a}T00:00:00Z`); d <= new Date(`${b}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !holidaySet.has(key)) n++;
  }
  return n;
};

/** Builds draft payslips from attendance and approved leave. Paid payslips are never overwritten. */
export async function runPayroll(c: Ctx, month: string, advances: Record<string, number>) {
  const start = `${month}-01`;
  const end = `${month}-${String(new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;
  const hols = (await db.select({ date: holidays.date }).from(holidays).where(and(eq(holidays.tenantId, c.tenantId), between(holidays.date, start, end)))).map((h) => h.date);
  const holidaySet = new Set(hols);
  const workingDays = workingDaysInMonth(month, hols);
  const emps = await db.select().from(employees).where(and(eq(employees.tenantId, c.tenantId), eq(employees.active, true)));
  const recs = await db.select().from(attendance).where(and(eq(attendance.tenantId, c.tenantId), between(attendance.date, start, end)));
  const approved = await db
    .select()
    .from(leaves)
    .where(and(eq(leaves.tenantId, c.tenantId), eq(leaves.status, "APPROVED"), lte(leaves.from, end), gte(leaves.to, start)));
  const paid = new Set(
    (await db.select({ e: payslips.employeeId }).from(payslips).where(and(eq(payslips.tenantId, c.tenantId), eq(payslips.month, month), eq(payslips.status, "PAID")))).map((p) => p.e),
  );

  await db.transaction(async (tx) => {
    await tx.delete(payslips).where(and(eq(payslips.tenantId, c.tenantId), eq(payslips.month, month), eq(payslips.status, "DRAFT")));
    for (const e of emps) {
      if (paid.has(e.id)) continue;
      const mine = recs.filter((r) => r.employeeId === e.id);
      const presentDays = mine.filter((r) => r.status === "PRESENT" || r.status === "LATE").length + mine.filter((r) => r.status === "HALF_DAY").length * 0.5;
      const lateCount = mine.filter((r) => r.status === "LATE").length;
      const paidLeaveDays = approved
        .filter((l) => l.employeeId === e.id && l.type !== "UNPAID")
        .reduce((s, l) => s + overlapDays(l.from, l.to, start, end, holidaySet), 0);
      const advancePaise = advances[e.id] ?? 0;
      const p = computePayslip({ monthlySalaryPaise: e.monthlySalaryPaise, workingDays, presentDays, paidLeaveDays, lateCount, advancePaise });
      await tx.insert(payslips).values({
        tenantId: c.tenantId, employeeId: e.id, month, workingDays, presentDays, paidLeaveDays, lateCount,
        payableDays: p.payableDays, basePaise: e.monthlySalaryPaise, grossPaise: p.grossPaise, advancePaise, netPaise: p.netPaise,
      });
    }
    await audit(tx, c, "payroll.run", "payroll", month);
  });
  return listPayslips(c.tenantId, month);
}

export async function listPayslips(tenantId: string, month: string) {
  const rows = await db
    .select({ p: payslips, name: employees.name, code: employees.code, designation: employees.designation, avatarHue: employees.avatarHue })
    .from(payslips)
    .innerJoin(employees, eq(employees.id, payslips.employeeId))
    .where(and(eq(payslips.tenantId, tenantId), eq(payslips.month, month)))
    .orderBy(employees.name);
  const items = rows.map((r) => ({ ...r.p, name: r.name, code: r.code, designation: r.designation, avatarHue: r.avatarHue }));
  return {
    month,
    items,
    totals: {
      grossPaise: items.reduce((s, i) => s + i.grossPaise, 0),
      netPaise: items.reduce((s, i) => s + i.netPaise, 0),
      advancePaise: items.reduce((s, i) => s + i.advancePaise, 0),
      paid: items.filter((i) => i.status === "PAID").length,
    },
  };
}

export async function markPaid(c: Ctx, ids: string[]) {
  await db.update(payslips).set({ status: "PAID" }).where(and(eq(payslips.tenantId, c.tenantId), inArray(payslips.id, ids)));
  await audit(db, c, "payroll.paid", "payslip", undefined, { count: ids.length });
  return { ok: true };
}

export async function payslipFor(tenantId: string, id: string) {
  const [r] = await db
    .select({ p: payslips, e: employees, t: tenants })
    .from(payslips)
    .innerJoin(employees, eq(employees.id, payslips.employeeId))
    .innerJoin(tenants, eq(tenants.id, payslips.tenantId))
    .where(and(eq(payslips.id, id), eq(payslips.tenantId, tenantId)));
  if (!r) throw notFound("Payslip");
  return r;
}
