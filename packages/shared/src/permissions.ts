export const ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "analytics.view",
  "products.view",
  "products.manage",
  "stock.view",
  "stock.move",
  "stock.adjust",
  "suppliers.manage",
  "purchases.manage",
  "orders.view",
  "orders.import",
  "orders.process",
  "returns.manage",
  "employees.view",
  "employees.manage",
  "tasks.manage",
  "tasks.self",
  "attendance.self",
  "attendance.view",
  "leave.self",
  "leave.approve",
  "payroll.manage",
  "billing.manage",
  "expenses.manage",
  "reports.view",
  "settings.manage",
  "users.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF: Permission[] = [
  "dashboard.view", "products.view", "stock.view", "stock.move", "orders.view", "orders.process",
  "tasks.self", "attendance.self", "leave.self",
];

const MANAGER: Permission[] = [
  ...STAFF,
  "analytics.view", "products.manage", "stock.adjust", "suppliers.manage", "purchases.manage",
  "orders.import", "returns.manage", "employees.view", "tasks.manage", "attendance.view",
  "leave.approve", "billing.manage", "expenses.manage", "reports.view",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER,
  STAFF,
};

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission);
