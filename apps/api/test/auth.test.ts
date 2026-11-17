import { describe, expect, it } from "vitest";
import { api, makeTenant } from "./kit";

describe("authentication", () => {
  it("logs in, sets an httpOnly refresh cookie and never returns the password hash", async () => {
    const t = await makeTenant();
    const res = await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: t.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
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
    for (let i = 0; i < 5; i++) await api().post("/api/v1/auth/login").send({ email: t.manager.email, password: "nope-nope" });
    const res = await api().post("/api/v1/auth/login").send({ email: t.manager.email, password: t.password });
    expect(res.status).toBe(423);
  });

  it("rotates refresh tokens and revokes everything when an old one is reused", async () => {
    const t = await makeTenant();
    const login = await api().post("/api/v1/auth/login").send({ email: t.owner.email, password: t.password });
    const first = login.headers["set-cookie"][0].split(";")[0];
    const r1 = await api().post("/api/v1/auth/refresh").set("Cookie", first);
    expect(r1.status).toBe(200);
    const second = r1.headers["set-cookie"][0].split(";")[0];
    expect(second).not.toBe(first);
    const reuse = await api().post("/api/v1/auth/refresh").set("Cookie", first);
    expect(reuse.status).toBe(401);
    const afterTheft = await api().post("/api/v1/auth/refresh").set("Cookie", second);
    expect(afterTheft.status).toBe(401);
  });

  it("rejects requests without a valid bearer token", async () => {
    expect((await api().get("/api/v1/products")).status).toBe(401);
    expect((await api().get("/api/v1/products").set("Authorization", "Bearer forged.token.here")).status).toBe(401);
  });
});

describe("role-based access and tenant isolation", () => {
  it("keeps staff out of reports, payroll and stock adjustments", async () => {
    const t = await makeTenant();
    expect((await t.asStaff.get("/api/v1/reports")).status).toBe(403);
    expect((await t.asStaff.get("/api/v1/payroll")).status).toBe(403);
    const adj = await t.asStaff.post("/api/v1/stock/moves").send({ variantId: t.variant.id, type: "ADJUSTMENT", qty: 5, reason: "count" });
    expect(adj.status).toBe(403);
  });

  it("keeps managers out of payroll and user admin", async () => {
    const t = await makeTenant();
    expect((await t.asManager.get("/api/v1/payroll")).status).toBe(403);
    expect((await t.asManager.get("/api/v1/users")).status).toBe(403);
    expect((await t.asManager.get("/api/v1/reports")).status).toBe(200);
  });

  it("never shows one business's data to another", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    const list = await b.asOwner.get("/api/v1/products");
    expect(list.body.items.map((p: { id: string }) => p.id)).not.toContain(a.product.id);
    expect((await b.asOwner.get(`/api/v1/products/${a.product.id}`)).status).toBe(404);
    const move = await b.asOwner.post("/api/v1/stock/moves").send({ variantId: a.variant.id, type: "INWARD", qty: 5, reason: "steal" });
    expect(move.status).toBe(404);
  });
});
