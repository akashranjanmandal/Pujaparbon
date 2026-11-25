import { describe, expect, it } from "vitest";
import { makeTenant, type Tenant } from "./kit";

/** The owner's example: 100 bottles for ₹1,000 plus trip costs. */
const buy = (t: Tenant, over: Record<string, unknown> = {}) =>
  t.asOwner.post("/api/v1/trips").send({
    date: "2026-11-10", place: "Barabazar", basis: "VALUE",
    items: [
      { newProduct: { name: "Steel Bottle", category: "Bottles" }, qty: 100, linePaise: 100000, unitPricePaise: 1500 },
      { newProduct: { name: "Lunch Box", category: "Kitchen" }, qty: 50, linePaise: 50000, unitPricePaise: 1300 },
    ],
    costs: [
      { kind: "Travel", amountPaise: 15000, paidBy: "Owner" },
      { kind: "Food", label: "Helper's food", amountPaise: 9000, paidBy: "Raju" },
      { kind: "Toll", amountPaise: 6000 },
    ],
    ...over,
  });
const byName = (res: { body: { items: { name: string }[] } }, name: string) => res.body.items.find((i) => i.name === name) as Record<string, number & string>;

describe("buying trips", () => {
  it("spreads trip costs over the items and adds stock at the real cost", async () => {
    const t = await makeTenant();
    const res = await buy(t);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ itemsPaise: 150000, costsPaise: 30000, totalPaise: 180000 });
    expect(byName(res, "Steel Bottle")).toMatchObject({ linePaise: 100000, extraPaise: 20000, landedPaise: 120000, unitCostPaise: 1200, pct: 25 });
    expect(byName(res, "Lunch Box")).toMatchObject({ extraPaise: 10000, landedPaise: 60000, unitCostPaise: 1200 });
    expect(res.body.code).toMatch(/^L[A-Z0-9]{6}$/);
    expect(res.body.expectedSalesPaise).toBe(100 * 1500 + 50 * 1300);
    expect(res.body.expectedProfitPaise).toBe(215000 - 180000);

    const list = await t.asOwner.get("/api/v1/products");
    expect(list.body.totals).toMatchObject({ products: 2, units: 150, valuePaise: 180000 });
    const b = list.body.items.find((i: { name: string }) => i.name === "Steel Bottle");
    expect(b).toMatchObject({ onHand: 100, avgCostPaise: 1200, sellingPricePaise: 1500, marginPct: 25 });
    expect(list.body.categories.map((c: { name: string }) => c.name)).toEqual(["Bottles", "Kitchen"]);
  });

  it("can spread by quantity instead", async () => {
    const t = await makeTenant();
    const res = await buy(t, { basis: "QTY" });
    expect(byName(res, "Steel Bottle").extraPaise).toBe(20000); // 100 of 150 pieces carry 2/3 of ₹300
  });

  it("reuses products on the next buy and keeps a weighted average cost", async () => {
    const t = await makeTenant();
    const first = await buy(t);
    const bottle = byName(first, "Steel Bottle");
    const second = await t.asOwner.post("/api/v1/trips").send({ date: "2026-11-12", items: [{ productId: bottle.productId, qty: 40, linePaise: 52000 }], costs: [{ kind: "Travel", amountPaise: 4000 }] });
    expect(second.status).toBe(201);
    const p = await t.asOwner.get(`/api/v1/products/${bottle.productId}`);
    expect(p.body.lots).toHaveLength(2);
    expect(p.body.onHand).toBe(140);
    expect(p.body.avgCostPaise).toBe(Math.round((120000 + 56000) / 140));
  });

  it("refuses the same product twice in one buy and an empty buy", async () => {
    const t = await makeTenant();
    const a = await buy(t);
    const pid = byName(a, "Lunch Box").productId;
    expect((await t.asOwner.post("/api/v1/trips").send({ date: "2026-11-12", items: [{ productId: pid, qty: 1, linePaise: 100 }, { productId: pid, qty: 1, linePaise: 100 }] })).status).toBe(400);
    expect((await t.asOwner.post("/api/v1/trips").send({ date: "2026-11-12", items: [] })).status).toBe(400);
  });

  it("deleting a buy takes its stock back out, unless it was already counted away", async () => {
    const t = await makeTenant();
    const a = await buy(t);
    expect((await t.asOwner.del(`/api/v1/trips/${a.body.id}`)).status).toBe(200);
    expect((await t.asOwner.get("/api/v1/products")).body.totals.units).toBe(0);
    const b = await buy(t);
    await t.asOwner.post("/api/v1/stock/counts").send({ counts: [{ productId: byName(b, "Steel Bottle").productId, counted: 3 }] });
    expect((await t.asOwner.del(`/api/v1/trips/${b.body.id}`)).status).toBe(409);
  });
});

describe("stock counts", () => {
  it("writes the difference to the ledger and keeps value in step", async () => {
    const t = await makeTenant();
    const a = await buy(t);
    const id = byName(a, "Steel Bottle").productId;
    const res = await t.asOwner.post("/api/v1/stock/counts").send({ counts: [{ productId: id, counted: 92 }] });
    expect(res.body).toMatchObject({ changed: 1, unitsDown: 8, valueDownPaise: 8 * 1200 });
    const p = (await t.asOwner.get("/api/v1/products")).body.items.find((i: { name: string }) => i.name === "Steel Bottle");
    expect(p).toMatchObject({ onHand: 92, valuePaise: 120000 - 9600, avgCostPaise: 1200 });
    expect(p.lastCountAt).toBeTypeOf("number");
  });
  it("counting to zero zeroes the value exactly", async () => {
    const t = await makeTenant();
    const a = await buy(t);
    const id = byName(a, "Steel Bottle").productId;
    await t.asOwner.post("/api/v1/stock/counts").send({ counts: [{ productId: id, counted: 0 }] });
    expect((await t.asOwner.get(`/api/v1/products/${id}`)).body).toMatchObject({ onHand: 0, valuePaise: 0 });
  });
  it("records a check even when nothing changed, and rejects negative counts", async () => {
    const t = await makeTenant();
    const a = await buy(t);
    const id = byName(a, "Steel Bottle").productId;
    expect((await t.asOwner.post("/api/v1/stock/counts").send({ counts: [{ productId: id, counted: 100 }] })).body).toMatchObject({ checked: 1, changed: 0 });
    expect((await t.asOwner.post("/api/v1/stock/counts").send({ counts: [{ productId: id, counted: -2 }] })).status).toBe(400);
  });
  it("updates selling prices and takes opening stock", async () => {
    const t = await makeTenant();
    const p = await t.asOwner.post("/api/v1/products").send({ name: "Old Stock Item", category: "Misc", openingQty: 10, openingUnitCostPaise: 5000 });
    expect(p.body).toMatchObject({ onHand: 10, valuePaise: 50000, avgCostPaise: 5000 });
    await t.asOwner.post("/api/v1/stock/prices").send({ prices: [{ productId: p.body.id, sellingPricePaise: 7500 }] });
    expect((await t.asOwner.get(`/api/v1/products/${p.body.id}`)).body).toMatchObject({ sellingPricePaise: 7500, marginPct: 50 });
  });
  it("renames a category everywhere", async () => {
    const t = await makeTenant();
    await buy(t);
    await t.asOwner.post("/api/v1/products/categories/rename").send({ from: "Bottles", to: "Bottles & Flasks" });
    expect((await t.asOwner.get("/api/v1/products/categories")).body.map((c: { name: string }) => c.name)).toContain("Bottles & Flasks");
  });
});

