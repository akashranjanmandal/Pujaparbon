/** Two kinds of login: the owner (does everything) and employees (check in and out). */
export const ROLES = ["OWNER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view", "analytics.view", "buy.manage", "stock.view", "stock.count", "products.manage", "platforms.manage",
  "investments.manage", "reports.view", "employees.manage", "attendance.view", "attendance.self",
  "settings.manage", "users.manage", "payroll.manage", "packaging.view", "packaging.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  STAFF: ["attendance.self"],
};

/** The only permissions the owner can hand to an employee role. Everything with money stays owner-only. */
export const ASSIGNABLE_PERMISSIONS = ["packaging.view", "packaging.manage"] as const satisfies readonly Permission[];
export const PERMISSION_LABELS: Record<(typeof ASSIGNABLE_PERMISSIONS)[number], string> = {
  "packaging.view": "See the packaging page (items in stock and packing materials)",
  "packaging.manage": "Update packing material counts",
};

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission);
