import { describe, expect, it } from "vitest";
import { FENCE, api, makeTenant } from "./kit";

const login = (t: { staff: { email: string }; password: string }, location?: object) =>
  api().post("/api/v1/auth/login").send({ email: t.staff.email, password: t.password, location });

describe("employee sign-in only at the shop", () => {
  it("refuses an employee with no location or far from the shop, lets the owner in from anywhere", async () => {
    const t = await makeTenant();
    expect((await login(t)).body.error?.code ?? (await login(t)).body.code).toMatch(/LOCATION_REQUIRED/);
    expect((await login(t, { lat: FENCE.lat + 0.1, lng: FENCE.lng, accuracyM: 10 })).status).toBe(403);
    expect((await login(t, { lat: FENCE.lat, lng: FENCE.lng, accuracyM: 10 })).status).toBe(200);
    const owner = await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: t.password });
    expect(owner.status).toBe(200);
  });
  it("shows the shop location on the public sign-in screen", async () => {
    await makeTenant();
    expect((await api().get("/api/v1/auth/fence")).body).toHaveProperty("radiusM");
  });
});

describe("employee roles", () => {
  it("gives packing access only through a role, and never money", async () => {
    const t = await makeTenant();
    expect((await t.asStaff.get("/api/v1/packaging")).status).toBe(403);
    const role = await t.asOwner.post("/api/v1/roles").send({ name: "Packing team", permissions: ["packaging.view", "packaging.manage"] });
    expect(role.status).toBe(201);
    await t.asOwner.patch(`/api/v1/users/${t.staff.id}`).send({ roleId: role.body.id });
    const tok = (await login(t, { lat: FENCE.lat, lng: FENCE.lng, accuracyM: 10 })).body.accessToken;
    const as = (url: string) => api().get(url).set("Authorization", `Bearer ${tok}`);
    expect((await as("/api/v1/packaging")).status).toBe(200);
    for (const url of ["/api/v1/products", "/api/v1/insights/summary", "/api/v1/attendance/payroll", "/api/v1/employees"]) expect((await as(url)).status, url).toBe(403);
  });
  it("cannot hand out money permissions", async () => {
    const t = await makeTenant();
    expect((await t.asOwner.post("/api/v1/roles").send({ name: "Sneaky", permissions: ["reports.view"] })).status).toBe(400);
  });
  it("refuses to delete a role that is still in use", async () => {
    const t = await makeTenant();
    const role = await t.asOwner.post("/api/v1/roles").send({ name: "Packers", permissions: [] });
    await t.asOwner.patch(`/api/v1/users/${t.staff.id}`).send({ roleId: role.body.id });
    expect((await t.asOwner.del(`/api/v1/roles/${role.body.id}`)).status).toBe(400);
  });
});

describe("packaging", () => {
  it("lists in-stock items without prices, and flags materials that are low", async () => {
    const t = await makeTenant();
    await t.asOwner.post("/api/v1/trips").send({ date: "2026-11-10", items: [{ newProduct: { name: "Bottle", category: "A" }, qty: 10, linePaise: 10000 }] });
    await t.asOwner.post("/api/v1/packaging/materials").send({ name: "Boxes", qty: 5, minQty: 10 });
    await t.asOwner.post("/api/v1/packaging/materials").send({ name: "Tape", qty: 50, minQty: 10 });
    const r = (await t.asOwner.get("/api/v1/packaging")).body;
    expect(r.items).toEqual([expect.objectContaining({ name: "Bottle", onHand: 10 })]);
    expect(JSON.stringify(r.items)).not.toMatch(/paise|cost|price/i);
    expect(r.needBuying.map((m: { name: string }) => m.name)).toEqual(["Boxes"]);
  });
});

describe("GST and trip-cost split", () => {
  it("shares trip costs per piece by default and adds GST only where chosen", async () => {
    const t = await makeTenant();
    const res = await t.asOwner.post("/api/v1/trips").send({
      date: "2026-11-10",
      items: [
        { newProduct: { name: "With GST", category: "A" }, qty: 10, linePaise: 10000, gstPct: 12 },
        { newProduct: { name: "Plain", category: "A" }, qty: 10, linePaise: 10000 },
      ],
      costs: [{ kind: "Travel", amountPaise: 2000 }],
    });
    const item = (n: string) => res.body.items.find((i: { name: string }) => i.name === n);
    expect(item("With GST")).toMatchObject({ linePaise: 11200, extraPaise: 1000, unitCostPaise: 1220 });
    expect(item("Plain")).toMatchObject({ linePaise: 10000, extraPaise: 1000, unitCostPaise: 1100 });
  });
});

describe("payroll", () => {
  it("works out month-end cash per employee and keeps salary away from the employee", async () => {
    const t = await makeTenant();
    await t.asOwner.patch(`/api/v1/employees/${t.emp.id}`).send({ salaryPaise: 2_600_000 });
    // November 2026 has 25 working days (Mon–Sat). Mark 20 present and 2 CL.
    for (let d = 2; d <= 21; d++) await t.asOwner.post("/api/v1/attendance/manual").send({ employeeId: t.emp.id, date: `2026-11-${String(d).padStart(2, "0")}`, status: "PRESENT" });
    for (const d of [23, 24]) await t.asOwner.post("/api/v1/attendance/manual").send({ employeeId: t.emp.id, date: `2026-11-${d}`, status: "CL" });
    const p = (await t.asOwner.get("/api/v1/attendance/payroll?month=2026-11")).body;
    const row = p.rows[0];
    expect(row.counts).toMatchObject({ PRESENT: 20, CL: 2 });
    expect(row.paidDays).toBe(22);
    expect(p.totalPaise).toBe(row.payablePaise);
    expect(JSON.stringify((await t.asStaff.get("/api/v1/attendance/me")).body)).not.toMatch(/salary/i);
    expect((await t.asStaff.get("/api/v1/attendance/payroll")).status).toBe(403);
  });
});
