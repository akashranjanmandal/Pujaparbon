import { describe, expect, it } from "vitest";
import { FENCE, makeTenant, SELFIE } from "./kit";

const here = (dLat = 0) => ({ lat: FENCE.lat + dLat, lng: FENCE.lng, accuracyM: 12, deviceId: "device-abc-123", selfie: SELFIE });

describe("geofenced selfie attendance", () => {
  it("blocks check-in from outside the fence and from a vague location", async () => {
    const t = await makeTenant();
    const far = await t.asStaff.post("/api/v1/attendance/check-in").send(here(0.01));
    expect(far.status).toBe(403);
    expect(far.body.error.code).toBe("OUTSIDE_GEOFENCE");
    const vague = await t.asStaff.post("/api/v1/attendance/check-in").send({ ...here(), accuracyM: 400 });
    expect(vague.body.error.code).toBe("LOW_ACCURACY");
  });

  it("checks in and out, binds the phone, and stores the selfies in the database", async () => {
    const t = await makeTenant();
    const inn = await t.asStaff.post("/api/v1/attendance/check-in").send(here(0.0002));
    expect(inn.status).toBe(201);
    expect(["PRESENT", "LATE"]).toContain(inn.body.status);
    expect((await t.asStaff.post("/api/v1/attendance/check-in").send(here())).status).toBe(409);

    const other = await t.asStaff.post("/api/v1/attendance/check-out").send({ ...here(), deviceId: "someone-elses-phone" });
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe("DEVICE_MISMATCH");
    expect((await t.asStaff.post("/api/v1/attendance/check-out").send(here())).status).toBe(200);
    expect((await t.asStaff.post("/api/v1/attendance/check-out").send(here())).status).toBe(409);

    const board = (await t.asOwner.get("/api/v1/attendance/today")).body;
    expect(board.summary.present + board.summary.late).toBe(1);
    const row = board.items[0].record;
    expect(row).toMatchObject({ hasPhoto: true });
    expect(row.checkInDistanceM).toBeLessThan(30);
    const img = await t.asOwner.get(`/api/v1/attendance/${row.id}/selfie/in`);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/jpeg");
    expect(img.body.length).toBeGreaterThan(1000);
    expect((await t.asStaff.get(`/api/v1/attendance/${row.id}/selfie/in`)).status).toBe(403);
  });

  it("rejects an upload that is not a photo", async () => {
    const t = await makeTenant();
    const bad = await t.asStaff.post("/api/v1/attendance/check-in").send({ ...here(), selfie: `data:image/jpeg;base64,${Buffer.alloc(2000, 7).toString("base64")}` });
    expect(bad.status).toBe(400);
  });

  it("lets the owner correct a day, add an employee and give them a login", async () => {
    const t = await makeTenant();
    const e = await t.asOwner.post("/api/v1/employees").send({ name: "New Helper", phone: "9812345678", designation: "Helper", joinDate: "2026-11-01" });
    expect(e.status).toBe(201);
    expect((await t.asOwner.post("/api/v1/attendance/manual").send({ employeeId: e.body.id, date: "2026-11-03", status: "HALF_DAY" })).status).toBe(200);
    expect((await t.asOwner.get("/api/v1/attendance/month?month=2026-11")).body.records).toEqual([{ employeeId: e.body.id, date: "2026-11-03", status: "HALF_DAY" }]);
    const login = await t.asOwner.post("/api/v1/users").send({ name: "New Helper", email: "helper@test.in", password: "Helper@12345", role: "STAFF", employeeId: e.body.id });
    expect(login.status).toBe(201);
    expect((await t.asOwner.post("/api/v1/users").send({ name: "X", email: "x@test.in", password: "Helper@12345", role: "STAFF" })).status).toBe(400);
    const list = (await t.asOwner.get("/api/v1/employees")).body.find((x: { id: string }) => x.id === e.body.id);
    expect(list.hasLogin).toBe(true);
  });
});
