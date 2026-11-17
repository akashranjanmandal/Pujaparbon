import { describe, expect, it } from "vitest";
import { mapColumns, parseDate, parseOrderRows, parseSettlementRows } from "./importer";

describe("marketplace importer", () => {
  it("maps Flipkart, Amazon and Meesho headers to the same fields", () => {
    expect(mapColumns(["Order Id", "SKU", "Quantity", "Invoice Amount"])).toMatchObject({ orderId: "Order Id", sku: "SKU", qty: "Quantity", lineTotal: "Invoice Amount" });
    expect(mapColumns(["amazon-order-id", "sku", "quantity-purchased", "item-price"])).toMatchObject({ orderId: "amazon-order-id", qty: "quantity-purchased", lineTotal: "item-price" });
    expect(mapColumns(["Sub Order No", "SKU", "Quantity", "Total Price"])).toMatchObject({ orderId: "Sub Order No" });
  });

  it("reads Indian dd-mm-yyyy dates as IST", () => {
    expect(parseDate("16-11-2026 10:30")?.toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(parseDate("2026-11-16T05:00:00Z")?.toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(parseDate("not a date")).toBeNull();
  });

  it("groups rows with the same order id into one multi-item order", () => {
    const { orders, issues } = parseOrderRows([
      { "Order Id": "OD1", SKU: "A", Quantity: "2", "Invoice Amount": "1,000" },
      { "Order Id": "OD1", SKU: "B", Quantity: "1", "Invoice Amount": "499" },
      { "Order Id": "OD2", SKU: "A", Quantity: "1", "Invoice Amount": "500" },
    ]);
    expect(issues).toEqual([]);
    expect(orders).toHaveLength(2);
    expect(orders[0].items).toEqual([
      { channelSku: "A", qty: 2, pricePaise: 50000 },
      { channelSku: "B", qty: 1, pricePaise: 49900 },
    ]);
    expect(orders[0].totalPaise).toBe(149900);
  });

  it("reports rows it cannot use instead of failing the whole file", () => {
    const { orders, issues } = parseOrderRows([
      { "Order Id": "", SKU: "A", Quantity: "1" },
      { "Order Id": "OD9", SKU: "A", Quantity: "1", "Selling Price": "abc" },
      { "Order Id": "OD10", SKU: "A", Quantity: "3", "Selling Price": "100" },
    ]);
    expect(issues.map((i) => i.row)).toEqual([2, 3]);
    expect(orders[0].totalPaise).toBe(30000);
  });

  it("refuses files with no order id column", () => {
    expect(parseOrderRows([{ Foo: "1", SKU: "A" }]).issues[0].message).toMatch(/Order ID/);
  });

  it("reads settlement files", () => {
    const { rows } = parseSettlementRows([{ "Order ID": "OD1", "Settlement Amount": "850.50", "Marketplace Fee": "-120" }]);
    expect(rows).toEqual([{ channelOrderId: "OD1", settledPaise: 85050, feesPaise: 12000 }]);
  });
});
