import { describe, expect, it } from "vitest";
import { computePay } from "./hr";

const base = { salaryPaise: 2_600_000, workingDays: 26, allowance: { CL: 6, SICK: 6, EARNED: 6 }, usedBefore: { CL: 0, SICK: 0, EARNED: 0 } };

describe("computePay", () => {
  it("pays the full salary when every working day is attended", () => {
    expect(computePay({ ...base, counts: { PRESENT: 24, LATE: 2 } }).payablePaise).toBe(2_600_000);
  });
  it("pays a half day as half and skips absent days", () => {
    // 22 present + 2 half (=1) = 23 days of 26
    expect(computePay({ ...base, counts: { PRESENT: 22, HALF_DAY: 2, ABSENT: 2 } }).payablePaise).toBe(2_300_000);
  });
  it("pays leave inside the allowance and not beyond it", () => {
    const r = computePay({ ...base, usedBefore: { CL: 5, SICK: 0, EARNED: 0 }, counts: { PRESENT: 22, CL: 3 } });
    expect(r.unpaidLeave).toBe(2); // only 1 CL day left of 6
    expect(r.paidDays).toBe(23);
  });
  it("always pays event leave and never pays more than the salary", () => {
    expect(computePay({ ...base, counts: { PRESENT: 26, EVENT: 3 } }).payablePaise).toBe(2_600_000);
  });
});
