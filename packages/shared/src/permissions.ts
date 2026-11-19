/** Two kinds of login: the owner (does everything) and employees (check in/out, look up an item by QR). */
export const ROLES = ["OWNER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view", "analytics.view", "buy.manage", "stock.view", "stock.count", "products.manage", "platforms.manage",
  "investments.manage", "reports.view", "employees.manage", "attendance.view", "attendance.self", "lookup.scan",
  "settings.manage", "users.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  STAFF: ["attendance.self", "lookup.scan"],
};

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission);
