import { describe, expect, it } from "vitest";
import { makeTenant } from "./kit";

const D = "2026-11-10";
const R = "from=2026-11-01&to=2026-11-30";

describe("processing, GST, couriers, funds and fairs", () => {
  it("turns raw goods plus colour and labour into finished stock with the whole cost", async () => {
    const t = await makeTenant();
    const biz = (await t.asOwner.get("/api/v1/businesses")).body;
    const raw = (await t.asOwner.post("/api/v1/products").send({ name: "Raw pot", category: "Raw", openingQty: 100, openingUnitCostPaise: 2000 })).body;
    const fin = (await t.asOwner.post("/api/v1/products").send({ name: "Painted pot", category: "Painted" })).body;
    const res = await t.asOwner.post("/api/v1/batches").send({ businessId: biz[3].id, date: D, name: "Diwali lot", inputs: [{ productId: raw.id, qty: 50 }], outputs: [{ productId: fin.id, qty: 50 }], costs: [{ kind: "Colour", amountPaise: 20000 }, { kind: "Labour", amountPaise: 30000 }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ inputsPaise: 100000, costsPaise: 50000, totalPaise: 150000 });
    const get = async (id: string) => (await t.asOwner.get(`/api/v1/products/${id}`)).body;
    expect((await get(raw.id)).onHand).toBe(50);
    const f = await get(fin.id);
    expect(f).toMatchObject({ onHand: 50, valuePaise: 150000, avgCostPaise: 3000 });
    expect((await t.asOwner.get("/api/v1/batches")).body[0].unitCostPaise).toBe(3000);
  });

  it("works out output GST on sales, input GST on buys, and the net", async () => {
    const t = await makeTenant();
    const biz = (await t.asOwner.get("/api/v1/businesses")).body;
    const p = (await t.asOwner.post("/api/v1/products").send({ name: "Idol", category: "Puja", gstPct: 5, openingQty: 20, openingUnitCostPaise: 5000 })).body;
    await t.asOwner.post("/api/v1/sales").send({ businessId: biz[0].id, channel: "SHOP", date: D, items: [{ productId: p.id, qty: 2, unitPricePaise: 10500 }] });
    await t.asOwner.post("/api/v1/trips").send({ date: D, businessId: biz[0].id, items: [{ productId: p.id, qty: 10, linePaise: 100000, gstPct: 12 }], costs: [] });
    const g = (await t.asOwner.get(`/api/v1/accounts/gst?${R}`)).body;
    expect(g.outputPaise).toBe(1000); // 21000 incl 5% -> 1000
    expect(g.inputPaise).toBe(Math.round((100000 * 1.12 * 12) / 112)); // 12000
    expect(g.netPaise).toBe(1000 - 12000);
  });

  it("logs courier movement, moves money between businesses, and gives a fair its own account", async () => {
    const t = await makeTenant();
    const biz = (await t.asOwner.get("/api/v1/businesses")).body;
    await t.asOwner.post("/api/v1/couriers").send({ date: D, courier: "Valmo", outgoing: 5, customerReturn: 3, rto: 0, time: "09:10" });
    await t.asOwner.post("/api/v1/couriers").send({ date: D, courier: "E-kart", outgoing: 10 });
    expect((await t.asOwner.get(`/api/v1/couriers?${R}`)).body.totals).toEqual({ outgoing: 15, customerReturn: 3, rto: 0 });
    expect((await t.asOwner.post("/api/v1/accounts/transfers").send({ date: D, fromBusinessId: biz[0].id, toBusinessId: biz[0].id, amountPaise: 100 })).status).toBe(400);
    await t.asOwner.post("/api/v1/accounts/transfers").send({ date: D, fromBusinessId: biz[0].id, toBusinessId: biz[2].id, amountPaise: 50000 });
    const a = (await t.asOwner.get(`/api/v1/accounts?${R}`)).body;
    expect(a.businesses.find((b: { id: string }) => b.id === biz[2].id).fundNetPaise).toBe(50000);
    expect(a.businesses.find((b: { id: string }) => b.id === biz[0].id).fundNetPaise).toBe(-50000);
    // a fair: sales and its own costs
    const fair = (await t.asOwner.post("/api/v1/locations").send({ name: "Kolkata book fair", kind: "MELA", businessId: biz[2].id })).body;
    const p = (await t.asOwner.post("/api/v1/products").send({ name: "Lamp", category: "Decor", openingQty: 10, openingUnitCostPaise: 1000 })).body;
    await t.asOwner.post("/api/v1/sales").send({ businessId: biz[2].id, locationId: fair.id, channel: "MELA", date: D, items: [{ productId: p.id, qty: 4, unitPricePaise: 2500 }] });
    await t.asOwner.post("/api/v1/investments").send({ date: D, label: "Stall rent", category: "Stall", amountPaise: 3000, businessId: biz[2].id, locationId: fair.id });
    const pl = (await t.asOwner.get(`/api/v1/accounts/places?${R}`)).body;
    expect(pl[0]).toMatchObject({ name: "Kolkata book fair", revenuePaise: 10000, cogsPaise: 4000, expensesPaise: 3000, profitPaise: 3000 });
    expect((await t.asOwner.post("/api/v1/investments").send({ date: D, label: "x", category: "y", amountPaise: 100, locationId: "nope" })).status).toBe(400);
  });
});

describe("quantities in kg and tons, and a panel per business", () => {
  it("buys, counts and sells fractional quantities, and lists only one business's things", async () => {
    const t = await makeTenant();
    const biz = (await t.asOwner.get("/api/v1/businesses")).body;
    const trip = await t.asOwner.post("/api/v1/trips").send({ date: D, businessId: biz[1].id, items: [{ newProduct: { name: "Shutki", category: "Fish", unit: "kg" }, qty: 12.5, linePaise: 250000 }], costs: [{ kind: "Travel", amountPaise: 5000 }, { kind: "Food", amountPaise: 2000 }] });
    expect(trip.status).toBe(201);
    const p = (await t.asOwner.get("/api/v1/products")).body.items[0];
    expect(p).toMatchObject({ onHand: 12.5, unit: "kg" });
    expect((await t.asOwner.post("/api/v1/stock/counts").send({ counts: [{ productId: p.id, counted: 12.25 }] })).status).toBe(200);
    expect((await t.asOwner.get(`/api/v1/products/${p.id}`)).body.onHand).toBe(12.25);
    await t.asOwner.post("/api/v1/products").send({ name: "Matka", category: "Clay", businessId: biz[0].id });
    const only = (name: string, items: { name: string }[]) => expect(items.map((i) => i.name)).toEqual([name]);
    only("Matka", (await t.asOwner.get(`/api/v1/products?businessId=${biz[0].id}`)).body.items);
    expect((await t.asOwner.get(`/api/v1/trips?businessId=${biz[0].id}`)).body.items).toHaveLength(0);
    expect((await t.asOwner.get(`/api/v1/trips?businessId=${biz[1].id}`)).body.items).toHaveLength(1);
  });
});

describe("salaries in business accounts", () => {
  it("carries a salary as an expense of the business the person works for, prorated to the range", async () => {
    const t = await makeTenant();
    const biz = (await t.asOwner.get("/api/v1/businesses")).body;
    // the kit's employee has no salary; give them one and a business
    await t.asOwner.patch(`/api/v1/employees/${t.emp.id}`).send({ salaryPaise: 3_000_000, businessId: biz[3].id });
    const month = "2026-03", payable = Math.round((3_000_000 * 11) / 26); // 26 working days (Sundays off); he was present for 11 of them
    for (const d of ["02", "03", "04", "05", "06", "09", "10", "11", "12", "13", "16"]) await t.asOwner.post("/api/v1/attendance/manual").send({ employeeId: t.emp.id, date: `${month}-${d}`, status: "PRESENT" });
    const full = (await t.asOwner.get(`/api/v1/accounts?from=${month}-01&to=${month}-31`)).body;
    const row = full.businesses.find((b: { id: string }) => b.id === biz[3].id);
    expect(row.salariesPaise).toBe(payable);
    expect(row.profitPaise).toBe(-payable);
    expect(full.total.salariesPaise).toBe(payable);
    // the first 10 days of a 31-day month carry 10/31 of it
    const part = (await t.asOwner.get(`/api/v1/accounts?from=${month}-01&to=${month}-10`)).body;
    expect(part.businesses.find((b: { id: string }) => b.id === biz[3].id).salariesPaise).toBe(Math.round((payable * 10) / 31));
    expect((await t.asOwner.patch(`/api/v1/employees/${t.emp.id}`).send({ businessId: "nope" })).status).toBe(400);
  });
});
