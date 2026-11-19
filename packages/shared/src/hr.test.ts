import { describe, expect, it } from "vitest";
import { attendanceStatus, istDateKey, workingDaysInMonth } from "./hr";

describe("attendance", () => {
  it("marks on-time inside the grace period (times in IST)", () => {
    // 10:09 IST = 04:39 UTC
    expect(attendanceStatus(new Date("2026-11-16T04:39:00Z"), "10:00", 10)).toBe("PRESENT");
  });
  it("marks late after the grace period", () => {
    expect(attendanceStatus(new Date("2026-11-16T04:41:00Z"), "10:00", 10)).toBe("LATE");
  });
  it("keys dates in IST, not UTC", () => {
    // 20:00 UTC on the 16th is 01:30 on the 17th in Kolkata
    expect(istDateKey(new Date("2026-11-16T20:00:00Z"))).toBe("2026-11-17");
  });
  it("counts working days excluding Sundays and holidays", () => {
    // Nov 2026 has 30 days and 5 Sundays
    expect(workingDaysInMonth("2026-11", [])).toBe(25);
    expect(workingDaysInMonth("2026-11", ["2026-11-09"])).toBe(24);
  });
});
