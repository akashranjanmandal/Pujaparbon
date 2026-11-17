import { describe, expect, it } from "vitest";
import { calcLine, calcInvoice } from "./gst";

describe("GST", () => {
  it("splits a GST-inclusive price into taxable value and tax", () => {
    // ₹1,050 inclusive of 5% GST => taxable ₹1,000, tax ₹50
    expect(calcLine({ ratePaise: 105000, qty: 1, gstRate: 5, inclusive: true })).toEqual({
      taxablePaise: 100000,
      taxPaise: 5000,
      totalPaise: 105000,
    });
  });
  it("adds GST on top of an exclusive price", () => {
    expect(calcLine({ ratePaise: 100000, qty: 2, gstRate: 12, inclusive: false })).toEqual({
      taxablePaise: 200000,
      taxPaise: 24000,
      totalPaise: 224000,
    });
  });
  it("uses CGST + SGST inside the seller's state", () => {
    const inv = calcInvoice(
      [{ ratePaise: 105000, qty: 1, gstRate: 5, inclusive: true }],
      { sellerState: "West Bengal", placeOfSupply: "West Bengal" },
    );
    expect(inv.cgstPaise).toBe(2500);
    expect(inv.sgstPaise).toBe(2500);
    expect(inv.igstPaise).toBe(0);
    expect(inv.totalPaise).toBe(105000);
  });
  it("uses IGST across states", () => {
    const inv = calcInvoice(
      [
        { ratePaise: 105000, qty: 1, gstRate: 5, inclusive: true },
        { ratePaise: 50000, qty: 3, gstRate: 12, inclusive: false },
      ],
      { sellerState: "West Bengal", placeOfSupply: "Odisha" },
    );
    expect(inv.igstPaise).toBe(5000 + 18000);
    expect(inv.cgstPaise + inv.sgstPaise).toBe(0);
    expect(inv.subtotalPaise).toBe(100000 + 150000);
    expect(inv.totalPaise).toBe(105000 + 168000);
  });
});
