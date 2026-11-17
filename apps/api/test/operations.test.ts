import { describe, expect, it } from "vitest";
import { makeTenant } from "./kit";

const onHand = async (t: Awaited<ReturnType<typeof makeTenant>>) =>
  (await t.asOwner.get("/api/v1/stock")).body.items.find((i: { variantId: string }) => i.variantId === t.variant.id).onHand as number;

describe("stock ledger", () => {
  it("adds stock from a purchase and records the supplier cost", async () => {
    const t = await makeTenant();
    const sup = await t.asManager.post("/api/v1/suppliers").send({ name: "Shantipur Weavers", city: "Shantipur" });
    expect(sup.status).toBe(201);
    const p = await t.asManager.post("/api/v1/purchases").send({
      supplierId: sup.body.id, invoiceNo: "SW-1", date: "2026-11-10", items: [{ variantId: t.variant.id, qty: 20, costPaise: 62000, binId: t.bin.id }],
    });
    expect(p.status).toBe(201);
    expect(p.body.number).toMatch(/^PP\/PO\/\d{2}-\d{2}\/0001$/);
    expect(await onHand(t)).toBe(20);
    const stock = (await t.asOwner.get("/api/v1/stock")).body.items[0];
    expect(stock.costPaise).toBe(62000);
    expect(stock.bins[0]).toEqual({ code: "A-01", qty: 20 });
  });

  it("refuses to send out more than is on the shelf", async () => {
    const t = await makeTenant();
    await t.asStaff.post("/api/v1/stock/moves").send({ variantId: t.variant.id, type: "INWARD", qty: 3, reason: "found in godown" });
    const res = await t.asStaff.post("/api/v1/stock/moves").send({ variantId: t.variant.id, type: "OUTWARD", qty: 5, reason: "sample" });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Only 3/);
    expect(await onHand(t)).toBe(3);
  });
});

describe("orders, dispatch and returns", () => {
  const csv = (t: { fkSku: string }) =>
    `Order Id,Order Date,SKU,Quantity,Invoice Amount,Customer Name,City,State,Dispatch By Date\nOD1,16-11-2026 10:30,${t.fkSku},2,2100,Ananya Sen,Kolkata,West Bengal,18-11-2026\nOD2,16-11-2026 11:00,UNKNOWN-SKU,1,999,Ravi Kumar,Patna,Bihar,18-11-2026\n`;

  it("imports a Flipkart report, skips duplicates and flags unmapped SKUs", async () => {
    const t = await makeTenant();
    const up = (name: string) => t.asManager.post("/api/v1/orders/import").field("channel", "FLIPKART").attach("file", Buffer.from(csv(t)), name);
    const first = await up("fk.csv");
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ imported: 2, duplicates: 0, unmappedSkus: ["UNKNOWN-SKU"] });
    const again = await up("fk-again.csv");
    expect(again.body).toMatchObject({ imported: 0, duplicates: 2 });
    const list = await t.asManager.get("/api/v1/orders?status=NEW");
    expect(list.body.total).toBe(2);
  });

  it("deducts stock only at dispatch, then restocks good returns and writes off damaged ones", async () => {
    const t = await makeTenant();
    await t.asManager.post("/api/v1/stock/moves").send({ variantId: t.variant.id, type: "INWARD", qty: 10, reason: "opening" });
    await t.asManager.post("/api/v1/orders/import").field("channel", "FLIPKART").attach("file", Buffer.from(csv(t)), "fk.csv");
    const orders = (await t.asManager.get("/api/v1/orders")).body.items;
    const od1 = orders.find((o: { channelOrderId: string }) => o.channelOrderId === "OD1");
    const od2 = orders.find((o: { channelOrderId: string }) => o.channelOrderId === "OD2");
    expect(await onHand(t)).toBe(10);

    expect((await t.asStaff.patch(`/api/v1/orders/${od1.id}/status`).send({ status: "DISPATCHED" })).status).toBe(409); // must pick and pack first
    for (const s of ["PICKED", "PACKED", "DISPATCHED"]) {
      expect((await t.asStaff.patch(`/api/v1/orders/${od1.id}/status`).send({ status: s })).status).toBe(200);
    }
    expect(await onHand(t)).toBe(8);

    // Unmapped SKU blocks dispatch with a clear message
    const bulk = await t.asStaff.post("/api/v1/orders/bulk-status").send({ orderIds: [od2.id], status: "PICKED" });
    expect(bulk.body.updated).toBe(1);
    await t.asStaff.patch(`/api/v1/orders/${od2.id}/status`).send({ status: "PACKED" });
    const blocked = await t.asStaff.patch(`/api/v1/orders/${od2.id}/status`).send({ status: "DISPATCHED" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/Map SKU UNKNOWN-SKU/);

    const good = await t.asManager.post("/api/v1/returns").send({ orderId: od1.id, variantId: t.variant.id, qty: 1, type: "CUSTOMER", condition: "GOOD", reason: "size issue" });
    expect(good.body.status).toBe("RESTOCKED");
    expect(await onHand(t)).toBe(9);
    const bad = await t.asManager.post("/api/v1/returns").send({ orderId: od1.id, variantId: t.variant.id, qty: 1, type: "RTO", condition: "DAMAGED", reason: "torn" });
    expect(bad.body.status).toBe("WRITTEN_OFF");
    expect(await onHand(t)).toBe(9);
    const over = await t.asManager.post("/api/v1/returns").send({ orderId: od1.id, variantId: t.variant.id, qty: 1, type: "CUSTOMER", condition: "GOOD", reason: "extra" });
    expect(over.status).toBe(409);
    expect((await t.asManager.get(`/api/v1/orders/${od1.id}`)).body.status).toBe("RETURNED");
  });

  it("reconciles settlements and flags short payments", async () => {
    const t = await makeTenant();
    await t.asManager.post("/api/v1/stock/moves").send({ variantId: t.variant.id, type: "INWARD", qty: 10, reason: "opening" });
    await t.asManager.post("/api/v1/orders/import").field("channel", "FLIPKART").attach("file", Buffer.from(csv(t)), "fk.csv");
    const od1 = (await t.asManager.get("/api/v1/orders")).body.items.find((o: { channelOrderId: string }) => o.channelOrderId === "OD1");
    for (const s of ["PICKED", "PACKED", "DISPATCHED"]) await t.asStaff.patch(`/api/v1/orders/${od1.id}/status`).send({ status: s });
    const settle = await t.asManager.post("/api/v1/orders/settlements/import").field("channel", "FLIPKART")
      .attach("file", Buffer.from("Order ID,Settlement Amount,Marketplace Fee\nOD1,1500,300\n"), "settle.csv");
    expect(settle.body.matched).toBe(1);
    const rec = await t.asManager.get("/api/v1/orders/reconciliation");
    expect(rec.body.summary.short).toBe(1);
    expect(rec.body.items[0].gapPaise).toBe(210000 - 30000 - 150000);
  });
});

describe("billing", () => {
  it("issues a West Bengal invoice with CGST + SGST and puts stock back on cancel", async () => {
    const t = await makeTenant();
    await t.asManager.post("/api/v1/stock/moves").send({ variantId: t.variant.id, type: "INWARD", qty: 5, reason: "opening" });
    const inv = await t.asManager.post("/api/v1/invoices").send({
      customerName: "Mitra Stores", placeOfSupply: "West Bengal", pricesInclusive: true, deductStock: true,
      items: [{ variantId: t.variant.id, description: "Tant Saree", hsn: "5208", qty: 2, ratePaise: 105000, gstRate: 5 }],
    });
    expect(inv.status).toBe(201);
    expect(inv.body).toMatchObject({ subtotalPaise: 200000, cgstPaise: 5000, sgstPaise: 5000, igstPaise: 0, totalPaise: 210000 });
    expect(await onHand(t)).toBe(3);
    const pdf = await t.asManager.get(`/api/v1/invoices/${inv.body.id}/pdf`);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);
    await t.asManager.post(`/api/v1/invoices/${inv.body.id}/cancel`);
    expect(await onHand(t)).toBe(5);
  });

  it("uses IGST for another state", async () => {
    const t = await makeTenant();
    const inv = await t.asManager.post("/api/v1/invoices").send({
      customerName: "Odisha buyer", placeOfSupply: "Odisha", deductStock: false,
      items: [{ description: "Brass diya", hsn: "7418", qty: 1, ratePaise: 112000, gstRate: 12 }],
    });
    expect(inv.body).toMatchObject({ igstPaise: 12000, cgstPaise: 0, totalPaise: 112000 });
  });
});
