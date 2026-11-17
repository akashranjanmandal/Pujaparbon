import { describe, expect, it } from "vitest";
import { FENCE, makeTenant, SELFIE } from "./kit";

const at = (dLat = 0) => ({ lat: FENCE.lat + dLat, lng: FENCE.lng, accuracyM: 12, deviceId: "device-abc-123", selfie: SELFIE });

describe("geofenced selfie attendance", () => {
  it("blocks check-in from outside the warehouse radius", async () => {
    const t = await makeTenant();
    const res = await t.asStaff.post("/api/v1/attendance/check-in").send(at(0.01)); // ~1.1 km away
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("OUTSIDE_GEOFENCE");
    expect(res.body.error.message).toMatch(/m from the warehouse/);
  });

  it("checks in inside the fence, binds the phone and refuses a second phone", async () => {
    const t = await makeTenant();
    const res = await t.asStaff.post("/api/v1/attendance/check-in").send(at(0.0002));
    expect(res.status).toBe(201);
    expect(["PRESENT", "LATE"]).toContain(res.body.status);
    expect(res.body.checkInDistanceM).toBeLessThan(30);
    expect((await t.asStaff.post("/api/v1/attendance/check-in").send(at())).status).toBe(409);
    const other = await t.asStaff.post("/api/v1/attendance/check-out").send({ ...at(), deviceId: "someone-elses-phone" });
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe("DEVICE_MISMATCH");
    expect((await t.asStaff.post("/api/v1/attendance/check-out").send(at())).status).toBe(200);
    const board = await t.asManager.get("/api/v1/attendance/today");
    expect(board.body.summary.present + board.body.summary.late).toBe(1);
    const selfie = await t.asManager.get(`/api/v1/attendance/${res.body.id}/selfie/in`);
    expect(selfie.status).toBe(200);
  });

  it("rejects an upload that is not a photo", async () => {
    const t = await makeTenant();
    const res = await t.asStaff.post("/api/v1/attendance/check-in").send({ ...at(), selfie: `data:image/jpeg;base64,${Buffer.alloc(2000, 7).toString("base64")}` });
    expect(res.status).toBe(400);
  });
});

describe("leave and payroll", () => {
  it("runs payroll from attendance, approved leave and advances", async () => {
    const t = await makeTenant();
    for (const d of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
      await t.asManager.post("/api/v1/attendance/manual").send({ employeeId: t.emp.id, date: d, status: "PRESENT" });
    }
    await t.asManager.post("/api/v1/attendance/manual").send({ employeeId: t.emp.id, date: "2026-10-05", status: "HALF_DAY" });
    const leave = await t.asStaff.post("/api/v1/leaves").send({ type: "CASUAL", from: "2026-10-06", to: "2026-10-07", reason: "Family puja" });
    expect(leave.status).toBe(201);
    expect(leave.body.days).toBe(2);
    expect((await t.asStaff.patch(`/api/v1/leaves/${leave.body.id}`).send({ status: "APPROVED" })).status).toBe(403);
    await t.asManager.patch(`/api/v1/leaves/${leave.body.id}`).send({ status: "APPROVED" });

    const run = await t.asOwner.post("/api/v1/payroll/run").send({ month: "2026-10", advances: { [t.emp.id]: 100000 } });
    expect(run.status).toBe(200);
    const slip = run.body.items[0];
    // Oct 2026: 31 days, 4 Sundays => 27 working days. 3.5 present + 2 leave = 5.5 payable.
    expect(slip.workingDays).toBe(27);
    expect(slip.payableDays).toBe(5.5);
    expect(slip.grossPaise).toBe(Math.round((1500000 / 27) * 5.5));
    expect(slip.netPaise).toBe(slip.grossPaise - 100000);
    const pdf = await t.asOwner.get(`/api/v1/payroll/${slip.id}/pdf`);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);
  });
});

describe("reports and insights", () => {
  it("exports reports as Excel and PDF, and builds the dashboard", async () => {
    const t = await makeTenant();
    const x = await t.asManager.get("/api/v1/reports/stock?format=xlsx");
    expect(x.status).toBe(200);
    expect(x.headers["content-type"]).toMatch(/spreadsheetml/);
    const p = await t.asManager.get("/api/v1/reports/sales?format=pdf&from=2026-11-01&to=2026-11-30");
    expect(p.headers["content-type"]).toMatch(/pdf/);
    const d = await t.asOwner.get("/api/v1/insights/dashboard");
    expect(d.status).toBe(200);
    expect(d.body.trend).toHaveLength(30);
    const a = await t.asOwner.get("/api/v1/insights/analytics");
    expect(a.body.pnl).toHaveLength(6);
    expect(a.body.heat).toHaveLength(7);
  });
});
