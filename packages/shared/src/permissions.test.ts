import { describe, expect, it } from "vitest";
import { can, ROLE_PERMISSIONS } from "./permissions";

describe("role-based access", () => {
  it("gives the owner every permission", () => {
    for (const p of new Set(Object.values(ROLE_PERMISSIONS).flat())) expect(can("OWNER", p)).toBe(true);
  });
  it("limits employees to their own attendance", () => {
    expect(can("STAFF", "attendance.self")).toBe(true);
    for (const p of ["buy.manage", "stock.count", "analytics.view", "reports.view", "investments.manage", "users.manage", "platforms.manage"] as const) {
      expect(can("STAFF", p)).toBe(false);
    }
  });
});
