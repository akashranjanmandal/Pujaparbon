import { describe, expect, it } from "vitest";
import { previousRange, resolveRange, monthsBetween, shiftDays } from "./range";

// Wednesday 18 Nov 2026, 11:00 IST
const NOW = new Date("2026-11-18T05:30:00Z");

describe("date ranges", () => {
  it("resolves presets in Kolkata time", () => {
    expect(resolveRange("today", NOW)).toEqual({ from: "2026-11-18", to: "2026-11-18" });
    expect(resolveRange("week", NOW)).toEqual({ from: "2026-11-16", to: "2026-11-22" }); // Monday to Sunday
    expect(resolveRange("month", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(resolveRange("lastMonth", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveRange("last30", NOW)).toEqual({ from: "2026-10-20", to: "2026-11-18" });
    expect(resolveRange("year", NOW)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("uses the IST date even late at night UTC", () => {
    expect(resolveRange("today", new Date("2026-11-18T20:00:00Z")).from).toBe("2026-11-19");
  });
  it("finds the period just before", () => {
    expect(previousRange({ from: "2026-11-01", to: "2026-11-30" })).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(previousRange({ from: "2026-11-16", to: "2026-11-22" })).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });
  it("lists the months a range touches", () => {
    expect(monthsBetween("2026-09-15", "2026-11-02")).toEqual(["2026-09", "2026-10", "2026-11"]);
  });
  it("shifts days", () => {
    expect(shiftDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
