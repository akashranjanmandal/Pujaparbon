import { describe, expect, it } from "vitest";
import { formatINR, toPaise, fromPaise, compactINR } from "./money";

describe("money", () => {
  it("formats paise with Indian digit grouping", () => {
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(-5000)).toBe("-₹50.00");
  });
  it("formats whole rupees when asked", () => {
    expect(formatINR(12345600, { decimals: false })).toBe("₹1,23,456");
  });
  it("compacts large amounts into lakh and crore", () => {
    expect(compactINR(1_50_00_000)).toBe("₹1.5L");
    expect(compactINR(2_30_00_00_000)).toBe("₹2.3Cr");
    expect(compactINR(99_900)).toBe("₹999");
  });
  it("converts rupee strings to integer paise without float drift", () => {
    expect(toPaise("12.50")).toBe(1250);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise("1,299")).toBe(129900);
    expect(fromPaise(129950)).toBe(1299.5);
  });
});
