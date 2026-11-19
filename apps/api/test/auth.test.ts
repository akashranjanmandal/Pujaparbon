import { describe, expect, it } from "vitest";
import { api, makeTenant } from "./kit";

describe("authentication", () => {
  it("logs in, sets an httpOnly refresh cookie and never returns the password hash", async () => {
    const t = await makeTenant();
    const res = await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: t.password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("OWNER");
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash/);
    expect(res.headers["set-cookie"][0]).toMatch(/pp_rt=.*HttpOnly.*SameSite=Strict/i);
  });
  it("gives the same error for a wrong password and an unknown email", async () => {
    const t = await makeTenant();
    const a = await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: "wrong-pass" });
    const b = await api().post("/api/v1/auth/login").send({ email: "nobody@test.in", password: "wrong-pass" });
    expect(a.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });
  it("locks the account after five failed attempts", async () => {
    const t = await makeTenant();
    for (let i = 0; i < 5; i++) await api().post("/api/v1/auth/login").send({ email: t.staff.email, password: "nope-nope" });
    expect((await api().post("/api/v1/auth/login").send({ email: t.staff.email, password: t.password })).status).toBe(423);
  });
  it("rotates refresh tokens and revokes everything when an old one is reused", async () => {
    const t = await makeTenant();
    const login = await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: t.password });
    const first = login.headers["set-cookie"][0].split(";")[0];
    const r1 = await api().post("/api/v1/auth/refresh").set("Cookie", first);
    expect(r1.status).toBe(200);
    const second = r1.headers["set-cookie"][0].split(";")[0];
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", first)).status).toBe(401);
    expect((await api().post("/api/v1/auth/refresh").set("Cookie", second)).status).toBe(401);
  });
  it("lets the owner change their own password", async () => {
    const t = await makeTenant();
    expect((await t.asOwner.post("/api/v1/auth/change-password").send({ current: "wrong", next: "NewPass@123" })).status).toBe(401);
    expect((await t.asOwner.post("/api/v1/auth/change-password").send({ current: t.password, next: "NewPass@123" })).status).toBe(200);
    expect((await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: "NewPass@123" })).status).toBe(200);
  });
});

describe("roles and tenant isolation", () => {
  it("keeps employees out of everything except attendance and QR look-ups", async () => {
    const t = await makeTenant();
    for (const url of ["/api/v1/products", "/api/v1/trips", "/api/v1/platforms", "/api/v1/insights/summary", "/api/v1/investments", "/api/v1/reports", "/api/v1/employees", "/api/v1/users"]) {
      expect((await t.asStaff.get(url)).status, url).toBe(403);
    }
    expect((await t.asStaff.post("/api/v1/stock/counts").send({ counts: [{ productId: "x", counted: 1 }] })).status).toBe(403);
    expect((await t.asStaff.get("/api/v1/attendance/me")).status).toBe(200);
  });
  it("rejects requests without a valid token", async () => {
    expect((await api().get("/api/v1/products")).status).toBe(401);
    expect((await api().get("/api/v1/products").set("Authorization", "Bearer forged.token.here")).status).toBe(401);
  });
  it("never shows one business's data to another", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const made = await a.asOwner.post("/api/v1/products").send({ name: "Secret Item", category: "Misc" });
    expect(made.status).toBe(201);
    expect((await b.asOwner.get("/api/v1/products")).body.items).toHaveLength(0);
    expect((await b.asOwner.get(`/api/v1/products/${made.body.id}`)).status).toBe(404);
    expect((await b.asOwner.get(`/api/v1/lookup/${made.body.code}`)).status).toBe(404);
  });
});
