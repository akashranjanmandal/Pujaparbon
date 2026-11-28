import { describe, expect, it } from "vitest";
import { makeTenant } from "./kit";

const D = "2026-11-10";
async function setup() {
  const t = await makeTenant();
  const biz = (await t.asOwner.get("/api/v1/businesses")).body;
  const clay = biz[0], fish = biz[1];
  const mk = async (name: string, cat: string, qty: number, cost: number) => (await t.asOwner.post("/api/v1/products").send({ name, category: cat, sellingPricePaise: cost * 2, openingQty: qty, openingUnitCostPaise: cost, businessId: clay.id })).body;
  const matka = await mk("Matka", "Clay", 100, 1000);
  const haat = (await t.asOwner.post("/api/v1/locations").send({ name: "Dola haat", kind: "HAAT", businessId: clay.id })).body;
  const onHand = async (id: string) => (await t.asOwner.get(`/api/v1/products/${id}`)).body.onHand;
  return { t, clay, fish, matka, haat, onHand };
}

describe("selling, losses, dues and accounts", () => {
  it("sells at a haat: stock goes down, cost is booked, unpaid part becomes a due", async () => {
    const { t, clay, matka, haat, onHand } = await setup();
    const cust = (await t.asOwner.post("/api/v1/dues").send({ name: "Sweet shop", kind: "CUSTOMER", businessId: clay.id })).body;
    const noCust = await t.asOwner.post("/api/v1/sales").send({ businessId: clay.id, channel: "WHOLESALE", date: D, items: [{ productId: matka.id, qty: 10, unitPricePaise: 1500 }], paidPaise: 5000 });
    expect(noCust.status).toBe(400);
    const sale = await t.asOwner.post("/api/v1/sales").send({ businessId: clay.id, locationId: haat.id, channel: "WHOLESALE", date: D, customerId: cust.id, items: [{ productId: matka.id, qty: 10, unitPricePaise: 1500 }], paidPaise: 5000 });
    expect(sale.status).toBe(201);
    expect(sale.body).toMatchObject({ totalPaise: 15000, costPaise: 10000, dueRaisedPaise: 10000 });
    expect(await onHand(matka.id)).toBe(90);
    expect((await t.asOwner.get(`/api/v1/dues?businessId=${clay.id}`)).body[0].duePaise).toBe(10000);
    await t.asOwner.post("/api/v1/dues/entries").send({ partyId: cust.id, kind: "PAYMENT", amountPaise: 4000, date: D });
    expect((await t.asOwner.get(`/api/v1/dues?businessId=${clay.id}`)).body[0].duePaise).toBe(6000);
    expect((await t.asOwner.del(`/api/v1/sales/${sale.body.id}`)).status).toBe(200);
    expect(await onHand(matka.id)).toBe(100);
    expect((await t.asOwner.get(`/api/v1/dues?businessId=${clay.id}`)).body[0].duePaise).toBe(-4000);
  });

  it("takes a daily total with no items and leaves stock alone", async () => {
    const { t, clay, matka, onHand } = await setup();
    const r = await t.asOwner.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D, totalPaise: 25000 });
    expect(r.status).toBe(201);
    expect(await onHand(matka.id)).toBe(100);
    expect((await t.asOwner.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D })).status).toBe(400);
  });

  it("returns: good goes back to stock, damaged goes to the loss account; waste too; fractions work", async () => {
    const { t, clay, fish, matka, onHand } = await setup();
    await t.asOwner.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D, items: [{ productId: matka.id, qty: 10, unitPricePaise: 1500 }] });
    await t.asOwner.post("/api/v1/losses/returns").send({ businessId: clay.id, productId: matka.id, qty: 2, date: D, condition: "GOOD", refundPaise: 3000 });
    expect(await onHand(matka.id)).toBe(92);
    await t.asOwner.post("/api/v1/losses/returns").send({ businessId: clay.id, productId: matka.id, qty: 1, date: D, condition: "DAMAGED", refundPaise: 1500 });
    expect(await onHand(matka.id)).toBe(92);
    await t.asOwner.post("/api/v1/losses").send({ businessId: clay.id, productId: matka.id, qty: 2, date: D, reason: "WASTE" });
    expect(await onHand(matka.id)).toBe(90);
    const l = (await t.asOwner.get(`/api/v1/losses?businessId=${clay.id}`)).body;
    expect(l.totalLossPaise).toBe(3000); // 1 damaged + 2 wasted, at Rs 10 each
    // fish sold by the kg
    const kg = (await t.asOwner.post("/api/v1/products").send({ name: "Shutki", category: "Fish", unit: "kg", openingQty: 50, openingUnitCostPaise: 20000, businessId: fish.id })).body;
    await t.asOwner.post("/api/v1/sales").send({ businessId: fish.id, channel: "SHOP", date: D, items: [{ productId: kg.id, qty: 2.5, unitPricePaise: 30000 }] });
    expect(await onHand(kg.id)).toBe(47.5);
  });

  it("transfers stock between places and shows profit per business and combined", async () => {
    const { t, clay, matka, haat } = await setup();
    const shop = (await t.asOwner.post("/api/v1/locations").send({ name: "Main shop", kind: "SHOP", businessId: clay.id })).body;
    expect((await t.asOwner.post("/api/v1/place-stock/transfer").send({ productId: matka.id, qty: 5, fromLocationId: haat.id, toLocationId: haat.id })).status).toBe(400);
    await t.asOwner.post("/api/v1/place-stock/transfer").send({ productId: matka.id, qty: 30, fromLocationId: null, toLocationId: shop.id });
    const st = (await t.asOwner.get(`/api/v1/place-stock?businessId=${clay.id}`)).body;
    expect(st.find((x: { locationId: string | null }) => x.locationId === shop.id).qty).toBe(30);
    expect(st.find((x: { locationId: string | null }) => x.locationId === null).qty).toBe(70);
    await t.asOwner.post("/api/v1/sales").send({ businessId: clay.id, locationId: shop.id, channel: "SHOP", date: D, items: [{ productId: matka.id, qty: 10, unitPricePaise: 1500 }] });
    await t.asOwner.post("/api/v1/losses").send({ businessId: clay.id, productId: matka.id, qty: 1, date: D, reason: "WASTE" });
    await t.asOwner.post("/api/v1/investments").send({ date: D, label: "Weighing scale", category: "Equipment", amountPaise: 2000, businessId: clay.id });
    const a = (await t.asOwner.get("/api/v1/accounts?from=2026-11-01&to=2026-11-30")).body;
    const c = a.businesses.find((b: { id: string }) => b.id === clay.id);
    // revenue 15000 − cost 10000 − loss 1000 − expense 2000
    expect(c).toMatchObject({ revenuePaise: 15000, cogsPaise: 10000, lossesPaise: 1000, expensesPaise: 2000, profitPaise: 2000 });
    expect(a.total.profitPaise).toBe(2000);
    expect((await t.asStaff.get("/api/v1/accounts?from=2026-11-01&to=2026-11-30")).status).toBe(403);
  });
});
