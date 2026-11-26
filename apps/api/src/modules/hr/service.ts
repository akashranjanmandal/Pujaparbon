import { and, between, desc, eq, sql } from "drizzle-orm";
import { LIMITED_LEAVES, attendanceStatus, checkGeofence, computePay, istDateKey, workingDaysInMonth, type AttendanceStatus, type CheckInInput, type EmployeeInput } from "@pp/shared";
import { db } from "../../db/client";
import { attendance, employees, tenants, users } from "../../db/schema";
import { AppError, badRequest, conflict, notFound } from "../../lib/errors";
import { audit } from "../../lib/audit";
import type { AuthContext } from "../../lib/http";

type Ctx = AuthContext;
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

/** A selfie arrives as a base64 JPEG data URL; we keep the bytes in the database. */
function decodeSelfie(dataUrl: string): Buffer {
  const buf = Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64");
  if (buf.length < 1000 || !buf.subarray(0, 3).equals(JPEG)) throw badRequest("Selfie is not a valid photo");
  return buf;
}

/* ── Employees ── */
export async function listEmployees(tenantId: string) {
  const today = istDateKey();
  const rows = await db
    .select({
      e: employees, todayStatus: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt,
      loginId: sql<string | null>`(select u.id from users u where u.employee_id = ${employees.id} limit 1)`,
      hasDevice: sql<number>`(select count(*) from users u where u.employee_id = ${employees.id} and u.device_id is not null)`,
    })
    .from(employees)
    .leftJoin(attendance, and(eq(attendance.employeeId, employees.id), eq(attendance.date, today)))
    .where(eq(employees.tenantId, tenantId))
    .orderBy(desc(employees.active), employees.name);
  return rows.map((r) => ({ ...r.e, todayStatus: r.todayStatus, checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, hasLogin: !!r.loginId, hasDevice: Number(r.hasDevice) > 0 }));
}

export async function getEmployee(tenantId: string, id: string) {
  const [e] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)));
  if (!e) throw notFound("Employee");
  const month = istDateKey().slice(0, 7);
  const att = await db
    .select({ id: attendance.id, date: attendance.date, status: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt, checkInDistanceM: attendance.checkInDistanceM, source: attendance.source, hasPhoto: sql<number>`${attendance.checkInPhoto} is not null` })
    .from(attendance)
    .where(and(eq(attendance.employeeId, id), between(attendance.date, `${month}-01`, `${month}-31`)))
    .orderBy(attendance.date);
  return { ...e, attendance: att.map((a) => ({ ...a, hasPhoto: !!a.hasPhoto })) };
}

export async function createEmployee(c: Ctx, input: EmployeeInput) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(employees).where(eq(employees.tenantId, c.tenantId));
  const [row] = await db.insert(employees).values({ ...input, tenantId: c.tenantId, code: `E${String(Number(n) + 1).padStart(3, "0")}`, avatarHue: Math.floor(Math.random() * 360) }).returning();
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

/* ── Attendance ── */
async function tenantRow(tenantId: string) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!t) throw notFound("Business");
  return t;
}

/** The phone a staff member first checks in from becomes theirs; another phone is refused. */
async function verifyDevice(c: Ctx, deviceId: string) {
  const [u] = await db.select({ deviceId: users.deviceId }).from(users).where(eq(users.id, c.userId));
  if (!u?.deviceId) return void (await db.update(users).set({ deviceId }).where(eq(users.id, c.userId)));
  if (u.deviceId !== deviceId) throw new AppError(403, "DEVICE_MISMATCH", "This phone is not your registered device. Ask the owner to reset it.");
}

export async function myToday(c: Ctx) {
  if (!c.employeeId) return { employee: null, record: null, fence: null };
  const t = await tenantRow(c.tenantId);
  const [e] = await db.select().from(employees).where(eq(employees.id, c.employeeId));
  const [record] = await db
    .select({ status: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt, checkInDistanceM: attendance.checkInDistanceM })
    .from(attendance)
    .where(and(eq(attendance.employeeId, c.employeeId), eq(attendance.date, istDateKey())));
  const month = istDateKey().slice(0, 7);
  const monthRows = await db.select({ status: attendance.status }).from(attendance).where(and(eq(attendance.employeeId, c.employeeId), between(attendance.date, `${month}-01`, `${month}-31`)));
  return {
    employee: e ? { id: e.id, name: e.name, designation: e.designation, avatarHue: e.avatarHue } : null, record: record ?? null,
    fence: { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM, shiftStart: e?.shiftStart ?? t.shiftStart, shiftEnd: t.shiftEnd, graceMin: t.lateGraceMin, name: t.name },
    month: { present: monthRows.filter((r) => r.status === "PRESENT").length, late: monthRows.filter((r) => r.status === "LATE").length, halfDay: monthRows.filter((r) => r.status === "HALF_DAY").length },
  };
}

export async function checkIn(c: Ctx, input: CheckInInput, now = new Date()) {
  if (!c.employeeId) throw badRequest("Your login is not linked to an employee record");
  const t = await tenantRow(c.tenantId);
  const fence = checkGeofence(input, { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM });
  if (!fence.allowed) {
    throw new AppError(403, fence.reason, fence.reason === "LOW_ACCURACY"
      ? `Location is too imprecise (±${Math.round(input.accuracyM)} m). Step near a window or turn on precise location.`
      : `You are ${fence.distanceM} m from the shop. Check-in works within ${t.geofenceRadiusM} m.`, { distanceM: fence.distanceM });
  }
  await verifyDevice(c, input.deviceId);
  const date = istDateKey(now);
  const [existing] = await db.select().from(attendance).where(and(eq(attendance.employeeId, c.employeeId), eq(attendance.date, date)));
  if (existing?.checkInAt) throw conflict("You have already checked in today");
  const [e] = await db.select({ shiftStart: employees.shiftStart }).from(employees).where(eq(employees.id, c.employeeId));
  const status = attendanceStatus(now, e?.shiftStart ?? t.shiftStart, t.lateGraceMin);
  const values = { status, checkInAt: now, checkInDistanceM: fence.distanceM, checkInPhoto: decodeSelfie(input.selfie), deviceId: input.deviceId, source: "GEOFENCE" as const };
  const [row] = existing
    ? await db.update(attendance).set(values).where(eq(attendance.id, existing.id)).returning({ id: attendance.id, status: attendance.status })
    : await db.insert(attendance).values({ tenantId: c.tenantId, employeeId: c.employeeId, date, ...values }).returning({ id: attendance.id, status: attendance.status });
  await audit(db, c, "attendance.check_in", "attendance", row.id, { distanceM: fence.distanceM, status });
  return { id: row.id, status: row.status };
}

export async function checkOut(c: Ctx, input: CheckInInput, now = new Date()) {
  if (!c.employeeId) throw badRequest("Your login is not linked to an employee record");
  const t = await tenantRow(c.tenantId);
  const fence = checkGeofence(input, { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM });
  if (!fence.allowed) throw new AppError(403, fence.reason, `You are ${fence.distanceM} m from the shop. Check-out works within ${t.geofenceRadiusM} m.`);
  await verifyDevice(c, input.deviceId);
  const [rec] = await db.select().from(attendance).where(and(eq(attendance.employeeId, c.employeeId), eq(attendance.date, istDateKey(now))));
  if (!rec?.checkInAt) throw conflict("Check in first");
  if (rec.checkOutAt) throw conflict("You have already checked out today");
  await db.update(attendance).set({ checkOutAt: now, checkOutDistanceM: fence.distanceM, checkOutPhoto: decodeSelfie(input.selfie) }).where(eq(attendance.id, rec.id));
  return { id: rec.id };
}

export async function todayBoard(tenantId: string, now = new Date()) {
  const date = istDateKey(now);
  const t = await tenantRow(tenantId);
  const [emps, recs] = await Promise.all([
    db.select().from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.active, true))).orderBy(employees.name),
    db
      .select({
        id: attendance.id, employeeId: attendance.employeeId, status: attendance.status, checkInAt: attendance.checkInAt, checkOutAt: attendance.checkOutAt,
        checkInDistanceM: attendance.checkInDistanceM, source: attendance.source, hasPhoto: sql<number>`${attendance.checkInPhoto} is not null`,
      })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.date, date))),
  ]);
  const items = emps.map((e) => {
    const r = recs.find((x) => x.employeeId === e.id);
    return { employee: { id: e.id, name: e.name, code: e.code, designation: e.designation, avatarHue: e.avatarHue }, record: r ? { ...r, hasPhoto: !!r.hasPhoto } : null, state: r?.status ?? "NOT_IN" };
  });
  return {
    date, fence: { lat: t.geofenceLat, lng: t.geofenceLng, radiusM: t.geofenceRadiusM }, items,
    summary: {
      total: items.length,
      present: items.filter((i) => i.state === "PRESENT").length,
      late: items.filter((i) => i.state === "LATE").length,
      halfDay: items.filter((i) => i.state === "HALF_DAY").length,
      notIn: items.filter((i) => i.state === "NOT_IN" || i.state === "ABSENT").length,
    },
  };
}

export async function monthGrid(tenantId: string, month: string) {
  const [emps, recs] = await Promise.all([
    db.select({ id: employees.id, name: employees.name, code: employees.code, avatarHue: employees.avatarHue }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.active, true))).orderBy(employees.name),
    db.select({ employeeId: attendance.employeeId, date: attendance.date, status: attendance.status }).from(attendance).where(and(eq(attendance.tenantId, tenantId), between(attendance.date, `${month}-01`, `${month}-31`))),
  ]);
  return { month, employees: emps, records: recs };
}

export async function markManual(c: Ctx, input: { employeeId: string; date: string; status: AttendanceStatus }) {
  const [e] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, c.tenantId)));
  if (!e) throw notFound("Employee");
  const [existing] = await db.select().from(attendance).where(and(eq(attendance.employeeId, input.employeeId), eq(attendance.date, input.date)));
  const [row] = existing
    ? await db.update(attendance).set({ status: input.status, source: "MANUAL" }).where(eq(attendance.id, existing.id)).returning({ id: attendance.id })
    : await db.insert(attendance).values({ tenantId: c.tenantId, employeeId: input.employeeId, date: input.date, status: input.status, source: "MANUAL" }).returning({ id: attendance.id });
  await audit(db, c, "attendance.manual", "attendance", row.id, { status: input.status });
  return row;
}

export async function photoFor(tenantId: string, attendanceId: string, kind: "in" | "out") {
  const [r] = await db.select({ inP: attendance.checkInPhoto, outP: attendance.checkOutPhoto }).from(attendance).where(and(eq(attendance.id, attendanceId), eq(attendance.tenantId, tenantId)));
  const buf = kind === "in" ? r?.inP : r?.outP;
  if (!buf) throw notFound("Selfie");
  return Buffer.from(buf);
}

/** Selfies are personal data: delete them once the owner's retention period has passed. Attendance itself stays. */
export async function purgeOldSelfies() {
  const ts = await db.select({ id: tenants.id, days: tenants.selfieRetentionDays }).from(tenants);
  let n = 0;
  for (const t of ts) {
    const cutoff = new Date(Date.now() - t.days * 86_400_000 + 330 * 60_000).toISOString().slice(0, 10);
    const res = await db.update(attendance).set({ checkInPhoto: null, checkOutPhoto: null }).where(and(eq(attendance.tenantId, t.id), sql`${attendance.date} < ${cutoff}`, sql`(${attendance.checkInPhoto} is not null or ${attendance.checkOutPhoto} is not null)`));
    n += res.rowsAffected;
  }
  return n;
}

/**
 * Month-end salary sheet: for every active employee, what to pay in cash. Paid-leave allowance is per calendar year,
 * so leave taken in earlier months of the year is counted before this month.
 */
export async function payroll(tenantId: string, month: string) {
  const t = await tenantRow(tenantId);
  const year = month.slice(0, 4);
  const [emps, recs] = await Promise.all([
    db.select().from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.active, true))).orderBy(employees.name),
    db.select({ employeeId: attendance.employeeId, date: attendance.date, status: attendance.status }).from(attendance).where(and(eq(attendance.tenantId, tenantId), between(attendance.date, `${year}-01-01`, `${month}-31`))),
  ]);
  const workingDays = workingDaysInMonth(month, []);
  const allowance = { CL: t.leaveCl, SICK: t.leaveSick, EARNED: t.leaveEarned };
  const rows = emps.map((e) => {
    const counts: Partial<Record<AttendanceStatus, number>> = {};
    const usedBefore = { CL: 0, SICK: 0, EARNED: 0 };
    for (const r of recs.filter((x) => x.employeeId === e.id)) {
      if (r.date.startsWith(month)) counts[r.status] = (counts[r.status] ?? 0) + 1;
      else if ((LIMITED_LEAVES as readonly string[]).includes(r.status)) usedBefore[r.status as keyof typeof usedBefore]++;
    }
    const pay = computePay({ salaryPaise: e.salaryPaise, workingDays, counts, allowance, usedBefore });
    return {
      employee: { id: e.id, name: e.name, code: e.code, designation: e.designation, avatarHue: e.avatarHue },
      salaryPaise: e.salaryPaise, counts, usedBefore, ...pay,
    };
  });
  return { month, workingDays, allowance, rows, totalPaise: rows.reduce((s, r) => s + r.payablePaise, 0) };
}
