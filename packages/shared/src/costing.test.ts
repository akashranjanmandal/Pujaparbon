import { describe, expect, it } from "vitest";
import { adjustmentFromPrice, allocateTrip, pctOver, priceFromAdjustment, priceFromPct, tripTotals } from "./costing";

describe("trip cost allocation", () => {
  it("spreads trip costs by value so the shares add up exactly", () => {
    // 100 bottles for ₹1,000 and 50 cups for ₹500; ₹300 of travel, food and toll
    const out = allocateTrip([{ qty: 100, linePaise: 100000 }, { qty: 50, linePaise: 50000 }], 30000, "VALUE");
    expect(out.map((o) => o.extraPaise)).toEqual([20000, 10000]);
    expect(out.map((o) => o.landedPaise)).toEqual([120000, 60000]);
    expect(out[0].unitCostPaise).toBe(1200); // ₹12.00 each, not ₹10
    expect(out[1].unitCostPaise).toBe(1200);
    expect(out.reduce((s, o) => s + o.extraPaise, 0)).toBe(30000);
  });

  it("never loses a paisa when the split is uneven", () => {
    const out = allocateTrip([{ qty: 1, linePaise: 100 }, { qty: 1, linePaise: 100 }, { qty: 1, linePaise: 100 }], 100, "VALUE");
    expect(out.reduce((s, o) => s + o.extraPaise, 0)).toBe(100);
    expect(out.map((o) => o.extraPaise).sort()).toEqual([33, 33, 34]);
  });

  it("can split by quantity instead of value", () => {
    const out = allocateTrip([{ qty: 100, linePaise: 100000 }, { qty: 300, linePaise: 30000 }], 40000, "QTY");
    expect(out.map((o) => o.extraPaise)).toEqual([10000, 30000]);
  });

  it("falls back to quantity when every line is free", () => {
    const out = allocateTrip([{ qty: 10, linePaise: 0 }, { qty: 30, linePaise: 0 }], 4000, "VALUE");
    expect(out.map((o) => o.extraPaise)).toEqual([1000, 3000]);
  });

  it("handles no extra costs", () => {
    const out = allocateTrip([{ qty: 4, linePaise: 1000 }], 0, "VALUE");
    expect(out[0]).toEqual({ extraPaise: 0, landedPaise: 1000, unitCostPaise: 250 });
  });

  it("summarises a trip", () => {
    const t = tripTotals([{ qty: 100, linePaise: 100000 }], [{ amountPaise: 5000 }, { amountPaise: 2500 }]);
    expect(t).toEqual({ itemsPaise: 100000, costsPaise: 7500, totalPaise: 107500, units: 100 });
  });
});

describe("pricing helpers", () => {
  it("adds an amount to cost and reports the percentage", () => {
    expect(priceFromAdjustment(1200, 300)).toEqual({ pricePaise: 1500, pct: 25 });
    expect(priceFromAdjustment(1200, -200)).toEqual({ pricePaise: 1000, pct: -16.7 });
  });
  it("works backwards from a price", () => {
    expect(adjustmentFromPrice(1200, 1500)).toEqual({ adjustPaise: 300, pct: 25 });
  });
  it("works from a percentage", () => {
    expect(priceFromPct(1200, 10)).toEqual({ pricePaise: 1320, adjustPaise: 120 });
    expect(priceFromPct(1200, -50)).toEqual({ pricePaise: 600, adjustPaise: -600 });
  });
  it("is safe when cost is zero", () => {
    expect(pctOver(0, 500)).toBe(0);
    expect(priceFromPct(0, 20)).toEqual({ pricePaise: 0, adjustPaise: 0 });
  });
  it("never produces a negative price", () => {
    expect(priceFromAdjustment(1000, -5000).pricePaise).toBe(0);
  });
});
