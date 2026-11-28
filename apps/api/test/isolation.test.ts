import { describe, expect, it } from "vitest";
import { makeTenant } from "./kit";

const D = "2026-11-10";
const R = "from=2026-11-01&to=2026-11-30";

async function two() {
  const t = await makeTenant();
  const [clay, fish] = t.biz;
  const o = t.rawOwner; // names no business unless the call does
  const mk = async (b: { id: string }, name: string, qty = 10) => (await o.post("/api/v1/products").send({ businessId: b.id, name, category: "X", openingQty: qty, openingUnitCostPaise: 1000 })).body;
  const matka = await mk(clay, "Matka"), shutki = await mk(fish, "Shutki");
  const clayPlace = (await o.post("/api/v1/locations").send({ businessId: clay.id, name: "Clay shop", kind: "SHOP" })).body;
  const fishPlace = (await o.post("/api/v1/locations").send({ businessId: fish.id, name: "Fish stall", kind: "HAAT" })).body;
  return { t, o, clay, fish, matka, shutki, clayPlace, fishPlace };
}

describe("every business is kept apart", () => {
  it("refuses to list any business data without saying which business", async () => {
    const t = await makeTenant();
    const urls = ["products", "products/categories", "trips", "sales", "losses", "place-stock", "dues", "locations", "platforms", "packaging", "batches", "couriers", "claims", "investments", `reports/stock?${R}`, `insights/summary?${R}`, `insights/home?${R}`];
    for (const u of urls) expect((await t.rawOwner.get(`/api/v1/${u}`)).status, u).toBe(400);
    // money alone can be seen across all of them
    expect((await t.rawOwner.get(`/api/v1/accounts?${R}`)).status).toBe(200);
    expect((await t.rawOwner.get(`/api/v1/accounts/gst?${R}`)).status).toBe(200);
  });

  it("shows each business only its own items, places, buys and sales", async () => {
    const { o, clay, fish, matka, shutki } = await two();
    const names = async (path: string, b: { id: string }) => (await o.get(`/api/v1/${path}?businessId=${b.id}`)).body.items.map((i: { name: string }) => i.name);
    expect(await names("products", clay)).toEqual(["Matka"]);
    expect(await names("products", fish)).toEqual(["Shutki"]);
    await o.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D, items: [{ productId: matka.id, qty: 1, unitPricePaise: 2000 }] });
    expect((await o.get(`/api/v1/sales?businessId=${fish.id}`)).body).toHaveLength(0);
    expect((await o.get(`/api/v1/sales?businessId=${clay.id}`)).body).toHaveLength(1);
    expect((await o.get(`/api/v1/place-stock?businessId=${fish.id}`)).body.map((r: { productId: string }) => r.productId)).toEqual([shutki.id]);
  });

  it("refuses anything that points at another business's records", async () => {
    const { t, o, clay, fish, matka, shutki, clayPlace, fishPlace } = await two();
    const bad = async (p: Promise<{ status: number }>) => expect((await p).status).toBe(400);
    // a sale: item, place and customer must all belong to the sale's business
    await bad(o.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D, items: [{ productId: shutki.id, qty: 1, unitPricePaise: 100 }] }));
    await bad(o.post("/api/v1/sales").send({ businessId: clay.id, locationId: fishPlace.id, channel: "SHOP", date: D, totalPaise: 100 }));
    const fishCust = (await o.post("/api/v1/dues").send({ businessId: fish.id, name: "Retailer", kind: "CUSTOMER" })).body;
    await bad(o.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D, customerId: fishCust.id, totalPaise: 100 }));
    // buys, returns, losses, batches
    await bad(o.post("/api/v1/trips").send({ businessId: clay.id, date: D, items: [{ productId: shutki.id, qty: 1, linePaise: 100 }] }));
    await bad(o.post("/api/v1/losses/returns").send({ businessId: clay.id, productId: shutki.id, qty: 1, date: D, condition: "GOOD" }));
    await bad(o.post("/api/v1/losses").send({ businessId: clay.id, productId: shutki.id, qty: 1, date: D, reason: "WASTE" }));
    await bad(o.post("/api/v1/batches").send({ businessId: clay.id, date: D, name: "x", inputs: [{ productId: matka.id, qty: 1 }], outputs: [{ productId: shutki.id, qty: 1 }] }));
    // moving stock: the item decides the business, and both places must be in it
    await bad(o.post("/api/v1/place-stock/transfer").send({ productId: matka.id, qty: 1, fromLocationId: null, toLocationId: fishPlace.id }));
    expect((await o.post("/api/v1/place-stock/transfer").send({ productId: matka.id, qty: 1, fromLocationId: null, toLocationId: clayPlace.id })).status).toBe(200);
    // spending, couriers, dues entries
    await bad(o.post("/api/v1/investments").send({ businessId: clay.id, locationId: fishPlace.id, date: D, label: "x", category: "y", amountPaise: 100 }));
    const fishPlat = (await o.post("/api/v1/platforms").send({ businessId: fish.id, name: "Meesho" })).body;
    await bad(o.post("/api/v1/couriers").send({ businessId: clay.id, platformId: fishPlat.id, date: D, courier: "Valmo", outgoing: 1 }));
    // a platform can be matched only to its own business's items
    await bad(o.post(`/api/v1/platforms/${fishPlat.id}/aliases`).send({ alias: "pot", productId: matka.id }));
    // claims follow the platform's business
    await bad(o.post("/api/v1/claims").send({ platformId: fishPlat.id, productId: matka.id, orderId: "A1", date: D, kind: "DAMAGED" }));
    // and an item can never be moved to another business afterwards
    const moved = await o.patch(`/api/v1/products/${matka.id}`).send({ businessId: fish.id, name: "Matka 2" });
    expect(moved.status).toBe(200);
    expect(moved.body.businessId).toBe(clay.id);
    expect(t.biz).toHaveLength(5);
  });

  it("matches marketplace sales only to items of the platform's own business", async () => {
    const { o, clay, fish } = await two();
    // both businesses sell an item called "Steel Pot"; the platform belongs to fish, so only fish's pot may match
    await o.post("/api/v1/products").send({ businessId: clay.id, name: "Steel Pot", category: "X", openingQty: 5, openingUnitCostPaise: 9000 });
    const fishPot = (await o.post("/api/v1/products").send({ businessId: fish.id, name: "Steel Pot", category: "X", openingQty: 5, openingUnitCostPaise: 4000 })).body;
    const plat = (await o.post("/api/v1/platforms").send({ businessId: fish.id, name: "Flipkart" })).body;
    const csv = "Order ID,Order Date,Product,Quantity,Sale Amount\nO1,2026-11-10,Steel Pot,1,200";
    const up = await o.post(`/api/v1/platforms/${plat.id}/reports`).field("kind", "SALES").attach("file", Buffer.from(csv), "r.csv");
    expect(up.status).toBe(201);
    expect(up.body.unmatched).toBe(0);
    const s = (await o.get(`/api/v1/insights/summary?${R}&businessId=${fish.id}`)).body;
    expect(s.totals.cogsPaise).toBe(fishPot ? 4000 : 0); // cost came from the fish pot, never the clay one
    // the clay business sees none of that platform's sales
    expect((await o.get(`/api/v1/insights/summary?${R}&businessId=${clay.id}`)).body.totals.netPaise).toBe(0);
    expect((await o.get(`/api/v1/platforms?businessId=${clay.id}`)).body).toEqual([]);
  });

  it("combines only money: profit per business and together", async () => {
    const { o, clay, fish, matka, shutki } = await two();
    await o.post("/api/v1/sales").send({ businessId: clay.id, channel: "SHOP", date: D, items: [{ productId: matka.id, qty: 2, unitPricePaise: 3000 }] });
    await o.post("/api/v1/sales").send({ businessId: fish.id, channel: "SHOP", date: D, items: [{ productId: shutki.id, qty: 3, unitPricePaise: 2000 }] });
    const a = (await o.get(`/api/v1/accounts?${R}`)).body;
    expect(a.businesses.find((b: { id: string }) => b.id === clay.id)).toMatchObject({ revenuePaise: 6000, profitPaise: 4000 });
    expect(a.businesses.find((b: { id: string }) => b.id === fish.id)).toMatchObject({ revenuePaise: 6000, profitPaise: 3000 });
    expect(a.total).toMatchObject({ revenuePaise: 12000, profitPaise: 7000 });
  });
});
