import { describe, expect, it } from "vitest";
import { istDateKey } from "@pp/shared";
import { makeTenant, type Tenant } from "./kit";

const CSV = [
  "Order ID,Order Date,Product,SKU,Quantity,Sale Amount,Platform Fee,Settlement Amount,State,Status",
  "OD1,05-11-2026,Steel Bottle,,2,30.00,4.00,26.00,West Bengal,Delivered",
  "OD2,06-11-2026,Steel Bottle,,1,15.00,2.00,13.00,Karnataka,Delivered",
  "OD3,07-11-2026,Steel Bottle,,1,15.00,0,0,Delhi,Returned",
  "OD4,08-11-2026,Mystery Item,,1,50.00,6.00,44.00,Bihar,Delivered",
].join("\n");

async function setup() {
  const t = await makeTenant();
  // 100 bottles at ₹12 landed; 50 lunch boxes at ₹12 landed (the owner's example)
  const buy = await t.asOwner.post("/api/v1/trips").send({
    date: "2026-11-10",
    items: [
      { newProduct: { name: "Steel Bottle", category: "Bottles" }, qty: 100, linePaise: 100000, unitPricePaise: 1500 },
      { newProduct: { name: "Lunch Box", category: "Kitchen" }, qty: 50, linePaise: 50000, unitPricePaise: 1300 },
    ],
    costs: [{ kind: "Travel", amountPaise: 15000 }, { kind: "Food", amountPaise: 9000 }, { kind: "Toll", amountPaise: 6000 }],
  });
  const flipkart = (await t.asOwner.post("/api/v1/platforms").send({ name: "Flipkart", color: "#2874F0" })).body;
  await t.asOwner.post("/api/v1/investments").send({ date: "2026-11-09", label: "Weighing scale", category: "Equipment", amountPaise: 1000 });
  return { t, buy, flipkart };
}
const upload = (t: Tenant, platformId: string, csv: string, month = "2026-11", mapping?: object, name = "report.csv") =>
  t.asOwner.post(`/api/v1/platforms/${platformId}/reports`).field("kind", "SALES").field("month", month).field("mapping", mapping ? JSON.stringify(mapping) : "").attach("file", Buffer.from(csv), name);
const range = "from=2026-11-01&to=2026-11-30";

describe("platform sales reports", () => {
  it("reads a standard report, skips repeats and flags items it cannot match", async () => {
    const { t, flipkart } = await setup();
    const pre = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/preview`).attach("file", Buffer.from(CSV), "r.csv");
    expect(pre.body).toMatchObject({ rows: 4, missing: [], usedSaved: false });
    expect(pre.body.mapping).toMatchObject({ orderId: "Order ID", amount: "Sale Amount", fees: "Platform Fee", settled: "Settlement Amount", state: "State", status: "Status", product: "Product" });

    const res = await upload(t, flipkart.id, CSV);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ imported: 4, duplicates: 0, unmatched: 1 });
    const again = await upload(t, flipkart.id, CSV);
    expect(again.body).toMatchObject({ imported: 0, duplicates: 4 }); // never counts a sale twice
  });

  it("works out profit and loss exactly", async () => {
    const { t, flipkart } = await setup();
    await upload(t, flipkart.id, CSV);
    const s = (await t.asOwner.get(`/api/v1/insights/summary?${range}`)).body;
    // delivered: 30+15+50 = ₹95 sold, ₹12 fees, ₹83 received; bottles sold cost 3 × ₹12 = ₹36 (Mystery Item has no cost yet)
    expect(s.totals).toMatchObject({ grossPaise: 9500, feesPaise: 1200, netPaise: 8300, cogsPaise: 3600, orders: 3, returnsPaise: 1500, returnOrders: 1 });
    // out: ₹1,500 items + ₹300 trip costs + ₹10 scale
    expect(s.totals).toMatchObject({ tripsItemsPaise: 150000, tripsCostsPaise: 30000, otherPaise: 1000, moneyOutPaise: 181000 });
    expect(s.totals.profitPaise).toBe(8300 - 3600 - 1000);
    expect(s.totals.cashPaise).toBe(8300 - 181000);
    expect(s.moneyOut.tripCosts).toEqual([{ kind: "Travel", amountPaise: 15000 }, { kind: "Food", amountPaise: 9000 }, { kind: "Toll", amountPaise: 6000 }]);
    expect(s.platforms[0]).toMatchObject({ name: "Flipkart", netPaise: 8300, feesPaise: 1200, orders: 3 });
    expect(s.states[0]).toMatchObject({ state: "Bihar", netPaise: 4400 });
    expect(s.categories.map((c: { category: string }) => c.category).sort()).toEqual(["Bottles", "Not matched yet"]);
    expect(s.stock).toMatchObject({ valuePaise: 180000, units: 150 });
  });

  it("limits figures to one platform when asked, and to the date range", async () => {
    const { t, flipkart } = await setup();
    await upload(t, flipkart.id, CSV);
    const one = (await t.asOwner.get(`/api/v1/insights/summary?${range}&platformId=${flipkart.id}`)).body;
    expect(one.totals).toMatchObject({ netPaise: 8300, profitPaise: 8300 - 3600, moneyOutPaise: 0 });
    const early = (await t.asOwner.get("/api/v1/insights/summary?from=2026-11-05&to=2026-11-06")).body;
    expect(early.totals).toMatchObject({ netPaise: 3900, orders: 2 });
    const empty = (await t.asOwner.get("/api/v1/insights/summary?from=2026-01-01&to=2026-01-31")).body;
    expect(empty.totals).toMatchObject({ netPaise: 0, moneyOutPaise: 0, profitPaise: 0 });
  });

  it("remembers a match: link the unfamiliar name once and its cost joins the profit", async () => {
    const { t, buy, flipkart } = await setup();
    await upload(t, flipkart.id, CSV);
    const un = (await t.asOwner.get(`/api/v1/platforms/${flipkart.id}/unmatched`)).body;
    expect(un).toEqual([{ name: "Mystery Item", units: 1, netPaise: 4400, lines: 1 }]);
    const box = buy.body.items.find((i: { name: string }) => i.name === "Lunch Box");
    expect((await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/aliases`).send({ alias: "Mystery Item", productId: box.productId })).status).toBe(200);
    expect((await t.asOwner.get(`/api/v1/platforms/${flipkart.id}/unmatched`)).body).toEqual([]);
    const s = (await t.asOwner.get(`/api/v1/insights/summary?${range}`)).body;
    expect(s.totals.cogsPaise).toBe(3600 + 1200);
    // a later report with the same name now matches by itself
    const next = await upload(t, flipkart.id, "Order ID,Order Date,Product,Quantity,Sale Amount\nOD9,12-11-2026,Mystery Item,1,40.00", "2026-11");
    expect(next.body).toMatchObject({ imported: 1, unmatched: 0 });
  });

  it("asks him to match columns once, then remembers them for next month", async () => {
    const { t, flipkart } = await setup();
    const odd = "Ref,Thing,Rupees,Pieces,Booked\nT1,Steel Bottle,15.00,1,2026-11-12\nT2,Steel Bottle,30.00,2,2026-11-13";
    const pre = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/preview`).attach("file", Buffer.from(odd), "odd.csv");
    expect(pre.body.missing).toEqual(["Sale amount", "Product name or SKU"]);
    expect((await upload(t, flipkart.id, odd)).status).toBe(400);
    const map = { amount: "Rupees", product: "Thing", orderId: "Ref", qty: "Pieces", date: "Booked" };
    const ok = await upload(t, flipkart.id, odd, "2026-11", map);
    expect(ok.body).toMatchObject({ imported: 2, unmatched: 0 });
    // next month: same layout, no mapping needed
    const month2 = "Ref,Thing,Rupees,Pieces,Booked\nT3,Steel Bottle,15.00,1,2026-12-02";
    const pre2 = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/preview`).attach("file", Buffer.from(month2), "dec.csv");
    expect(pre2.body).toMatchObject({ missing: [], usedSaved: true });
    expect((await upload(t, flipkart.id, month2, "2026-12")).body.imported).toBe(1);
  });

  it("guesses columns by whole words too, so fewer files need matching", async () => {
    const { t, flipkart } = await setup();
    const csv = "Txn Ref,Item Title,Amount Paid,Qty,Fee Charged,Customer State\nT1,Steel Bottle,15.00,1,2.00,Assam";
    const pre = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/preview`).attach("file", Buffer.from(csv), "x.csv");
    expect(pre.body.missing).toEqual([]);
    expect(pre.body.mapping).toMatchObject({ product: "Item Title", amount: "Amount Paid", qty: "Qty", state: "Customer State" });
  });

  it("keeps invoices and reports as downloadable files, tracks the months, and deletes cleanly", async () => {
    const { t, flipkart } = await setup();
    const month = istDateKey().slice(0, 7);
    const pdf = Buffer.from("%PDF-1.4 invoice");
    const inv = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/reports`).field("kind", "INVOICE").field("month", month).field("amountPaise", "1200").attach("file", pdf, "invoice.pdf");
    expect(inv.status).toBe(201);
    const sales = await upload(t, flipkart.id, CSV, month);
    const tracker = (await t.asOwner.get(`/api/v1/platforms/${flipkart.id}`)).body;
    const inv0 = tracker.reports.find((x: { kind: string }) => x.kind === "INVOICE");
    expect(tracker.reports).toHaveLength(2);
    expect(inv0.amountPaise).toBe(1200);
    const file = await t.asOwner.get(`/api/v1/platforms/reports/${inv.body.id}/file`);
    expect(file.headers["content-type"]).toMatch(/pdf/);
    expect(Buffer.from(file.body).toString()).toBe("%PDF-1.4 invoice");
    expect((await t.asOwner.del(`/api/v1/platforms/reports/${sales.body.id}`)).status).toBe(200);
    expect((await t.asOwner.get(`/api/v1/insights/summary?${range}`)).body.totals.netPaise).toBe(0);
  });

  it("reads a Meesho orders file and a Flipkart returns file with no month given", async () => {
    const { t, flipkart } = await setup();
    const meesho = '"Reason for Credit Entry","Sub Order No","Order Date","Customer State","Product Name","SKU","Quantity","Supplier Discounted Price (Incl GST and Commision)"\n'
      + '"DELIVERED","1_1","2026-09-05","Assam","Grinder","ST-1","1","450.0"\n"RTO_COMPLETE","2_1","2026-09-06","Bihar","Grinder","ST-1","1","450.0"\n"CANCELLED","3_1","2026-10-02","Bihar","Grinder","ST-1","1","450.0"';
    const pre = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/preview`).attach("file", Buffer.from(meesho), "m.csv");
    expect(pre.body.missing).toEqual([]);
    expect(pre.body.mapping).toMatchObject({ amount: "Supplier Discounted Price (Incl GST and Commision)", status: "Reason for Credit Entry", orderId: "Sub Order No", state: "Customer State" });
    const up = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/reports`).field("kind", "SALES").attach("file", Buffer.from(meesho), "m.csv");
    expect(up.status).toBe(201);
    expect(up.body.imported).toBe(3);
    const rep = (await t.asOwner.get(`/api/v1/platforms/${flipkart.id}`)).body.reports[0];
    expect(rep.month).toBe("2026-09");
    expect([rep.from, rep.to]).toEqual(["2026-09-05", "2026-10-02"]);
    const returns = 'Order ID,Return ID,SKU,Product,Total Price,Quantity,Return Requested Date\nOD1,R1,TP-1,Tadka Pan,134.0,1,"21 November, 2026"';
    const pre2 = await t.asOwner.post(`/api/v1/platforms/${flipkart.id}/preview`).attach("file", Buffer.from(returns), "r.csv");
    expect(pre2.body.returns).toBe(true);
    expect(pre2.body.missing).toEqual([]);
  });

  it("refuses a duplicate platform and removes a platform with everything under it", async () => {
    const { t, flipkart } = await setup();
    expect((await t.asOwner.post("/api/v1/platforms").send({ name: "Flipkart" })).status).toBe(409);
    await upload(t, flipkart.id, CSV);
    expect((await t.asOwner.del(`/api/v1/platforms/${flipkart.id}`)).status).toBe(200);
    expect((await t.asOwner.get("/api/v1/platforms")).body).toEqual([]);
  });
});

describe("money overview, reports and nudges", () => {
  it("lists buys and other investments together with totals by category", async () => {
    const { t } = await setup();
    const o = (await t.asOwner.get(`/api/v1/investments?${range}`)).body;
    expect(o).toMatchObject({ totalPaise: 181000, buyPaise: 180000, otherPaise: 1000 });
    expect(o.timeline.map((x: { type: string }) => x.type)).toEqual(["BUY", "OTHER"]);
    expect(o.byCategory.map((c: { category: string }) => c.category)).toEqual(["Stock buying", "Equipment"]);
  });
  it("exports every report as Excel and PDF", async () => {
    const { t, flipkart } = await setup();
    await upload(t, flipkart.id, CSV);
    for (const type of ["pnl", "buys", "stock", "sales", "platforms", "investments", "attendance"]) {
      const x = await t.asOwner.get(`/api/v1/reports/${type}?format=xlsx&${range}`);
      expect(x.status, type).toBe(200);
      expect(x.headers["content-type"]).toMatch(/spreadsheetml/);
      const p = await t.asOwner.get(`/api/v1/reports/${type}?format=pdf&${range}`);
      expect(p.headers["content-type"], type).toMatch(/pdf/);
    }
    const pnl = (await t.asOwner.get(`/api/v1/reports/pnl?${range}`)).body;
    expect(pnl.rows.find((r: { line: string }) => r.line.startsWith("PROFIT")).amount).toBe(8300 - 3600 - 1000);
  });
  it("nudges him to count stock and match unfamiliar items", async () => {
    const { t, flipkart } = await setup();
    await upload(t, flipkart.id, CSV);
    const notes = (await t.asOwner.get("/api/v1/insights/notifications")).body.map((n: { id: string }) => n.id);
    expect(notes).toContain("count");
    expect(notes).toContain("unmatched");
    expect((await t.asStaff.get("/api/v1/insights/notifications")).body).toEqual([]);
  });
});
