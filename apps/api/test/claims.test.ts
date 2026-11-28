import { describe, expect, it } from "vitest";
import { makeTenant } from "./kit";

describe("marketplace claims", () => {
  it("tracks raised, approved and rejected claims and the gap between expected and paid", async () => {
    const t = await makeTenant();
    const pl = (await t.asOwner.post("/api/v1/platforms").send({ name: "Meesho" })).body;
    const mk = (orderId: string, extra: object = {}) => t.asOwner.post("/api/v1/claims").send({ platformId: pl.id, orderId, date: "2026-11-10", kind: "DAMAGED", expectedPaise: 45000, ...extra });
    const a = (await mk("A1")).body, b = (await mk("B1")).body;
    await mk("C1");
    await t.asOwner.patch(`/api/v1/claims/${a.id}`).send({ status: "APPROVED", receivedPaise: 40257, reason: "Customer returned a different item" });
    await t.asOwner.patch(`/api/v1/claims/${b.id}`).send({ status: "REJECTED", reason: "Packing was poor" });
    const r = (await t.asOwner.get("/api/v1/claims")).body;
    expect(r.summary).toMatchObject({ raised: 3, approved: 1, rejected: 1, pending: 1, expectedPaise: 45000, receivedPaise: 40257, shortfallPaise: 4743, rejectedPaise: 45000 });
    expect(r.claims.find((x: { id: string }) => x.id === a.id).gapPaise).toBe(4743);
    expect((await t.asOwner.post("/api/v1/claims").send({ platformId: "nope", orderId: "X", date: "2026-11-10", kind: "OTHER" })).status).toBe(400);
    expect((await t.asStaff.get("/api/v1/claims")).status).toBe(403);
  });
});
