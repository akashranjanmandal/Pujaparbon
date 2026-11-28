import { describe, expect, it } from "vitest";
import { makeTenant } from "./kit";

describe("businesses and places", () => {
  it("starts with the five family businesses and lets the owner add places to each", async () => {
    const t = await makeTenant();
    const list = (await t.asOwner.get("/api/v1/businesses")).body;
    expect(list.map((b: { kind: string }) => b.kind)).toEqual(["CLAY", "FISH", "MELA", "PAINT", "ONLINE"]);
    const [clay, fish] = list;
    const haat = await t.asOwner.post("/api/v1/locations").send({ name: "Dola haat", kind: "HAAT", businessId: clay.id, days: ["SUN", "WED"] });
    expect(haat.status).toBe(201);
    expect((await t.asOwner.post("/api/v1/locations").send({ name: "Dola haat", kind: "HAAT", businessId: clay.id })).status).toBe(409);
    // the same name in another business is a different place
    expect((await t.asOwner.post("/api/v1/locations").send({ name: "Dola haat", kind: "HAAT", businessId: fish.id })).status).toBe(201);
    expect((await t.asOwner.get(`/api/v1/locations?businessId=${clay.id}`)).body).toHaveLength(1);
    expect((await t.asOwner.get(`/api/v1/locations?businessId=${clay.id}`)).body[0].days).toEqual(["SUN", "WED"]);
    expect((await t.asStaff.post("/api/v1/locations").send({ name: "X shop", kind: "SHOP" })).status).toBe(403);
  });

  it("keeps wholesale price and business on a product, and refuses another tenant's business", async () => {
    const a = await makeTenant(), b = await makeTenant();
    const biz = (await a.asOwner.get("/api/v1/businesses")).body[1];
    const p = await a.asOwner.post("/api/v1/products").send({ name: "Matka", category: "Clay", sellingPricePaise: 5000, wholesalePricePaise: 4000, businessId: biz.id });
    expect(p.status).toBe(201);
    expect(p.body).toMatchObject({ wholesalePricePaise: 4000, businessId: biz.id });
    const bad = await b.asOwner.post("/api/v1/products").send({ name: "Matka", category: "Clay", businessId: biz.id });
    expect(bad.status).toBe(400);
  });
});
