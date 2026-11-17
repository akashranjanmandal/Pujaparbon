import { describe, expect, it } from "vitest";
import { can, ROLE_PERMISSIONS } from "./permissions";

describe("role-based access", () => {
  it("gives the owner every permission", () => {
    const all = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const p of all) expect(can("OWNER", p)).toBe(true);
  });
  it("lets managers run operations but not payroll or user admin", () => {
    expect(can("MANAGER", "stock.adjust")).toBe(true);
    expect(can("MANAGER", "orders.import")).toBe(true);
    expect(can("MANAGER", "payroll.manage")).toBe(false);
    expect(can("MANAGER", "users.manage")).toBe(false);
  });
  it("limits staff to their own attendance, tasks and stock entry", () => {
    expect(can("STAFF", "attendance.self")).toBe(true);
    expect(can("STAFF", "stock.move")).toBe(true);
    expect(can("STAFF", "stock.adjust")).toBe(false);
    expect(can("STAFF", "reports.view")).toBe(false);
    expect(can("STAFF", "billing.manage")).toBe(false);
  });
});
