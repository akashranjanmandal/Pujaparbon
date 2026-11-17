import type { Permission } from "@pp/shared";
import {
  Activity, Boxes, BriefcaseBusiness, CalendarDays, ClipboardList, Cog, Fingerprint, FileSpreadsheet, Gauge, LineChart, Package,
  PackageOpen, Receipt, Scale, ShoppingCart, Truck, Undo2, Users, Wallet, WalletCards, Warehouse, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; hint: string; icon: LucideIcon; perm: Permission; staffOnly?: boolean; hideForStaff?: boolean; key?: string }
export interface NavGroup { id: string; title: string; icon: LucideIcon; items: NavItem[] }

/** Navigation is grouped into the dock's sections; each page is a tab inside its section. */
export const NAV: NavGroup[] = [
  {
    id: "ops", title: "Ops", icon: Gauge,
    items: [
      { href: "/me", label: "My Shift", hint: "Check in, tasks, leave", icon: Fingerprint, perm: "attendance.self", staffOnly: true },
      { href: "/dashboard", label: "Command Center", hint: "Live state of the business", icon: Activity, perm: "dashboard.view", hideForStaff: true, key: "g c" },
      { href: "/analytics", label: "Analytics", hint: "P&L, margins, demand", icon: LineChart, perm: "analytics.view", key: "g a" },
    ],
  },
  {
    id: "orders", title: "Orders", icon: ShoppingCart,
    items: [
      { href: "/orders", label: "Orders & Dispatch", hint: "Import, pick, pack, ship", icon: PackageOpen, perm: "orders.view", key: "g o" },
      { href: "/returns", label: "Returns", hint: "RTO and customer returns", icon: Undo2, perm: "returns.manage" },
      { href: "/reconciliation", label: "Settlements", hint: "Marketplace payouts", icon: Scale, perm: "orders.import" },
    ],
  },
  {
    id: "inventory", title: "Inventory", icon: Warehouse,
    items: [
      { href: "/products", label: "Catalogue", hint: "Products, SKUs, listings", icon: Package, perm: "products.view", key: "g p" },
      { href: "/stock", label: "Stock", hint: "Levels, bins, ledger", icon: Boxes, perm: "stock.view", key: "g s" },
      { href: "/purchases", label: "Purchasing", hint: "Suppliers and inward", icon: Truck, perm: "purchases.manage" },
    ],
  },
  {
    id: "people", title: "People", icon: Users,
    items: [
      { href: "/hr/attendance", label: "Attendance", hint: "Geofenced check-ins", icon: Fingerprint, perm: "attendance.view" },
      { href: "/hr/employees", label: "Workforce", hint: "Team directory", icon: BriefcaseBusiness, perm: "employees.view" },
      { href: "/hr/tasks", label: "Tasks", hint: "Assign and track", icon: ClipboardList, perm: "tasks.manage" },
      { href: "/hr/leave", label: "Leave", hint: "Requests and holidays", icon: CalendarDays, perm: "leave.approve" },
      { href: "/hr/payroll", label: "Payroll", hint: "Salaries and payslips", icon: Wallet, perm: "payroll.manage" },
    ],
  },
  {
    id: "finance", title: "Finance", icon: WalletCards,
    items: [
      { href: "/billing", label: "GST Billing", hint: "Tax invoices", icon: Receipt, perm: "billing.manage" },
      { href: "/expenses", label: "Expenses", hint: "Operating costs", icon: WalletCards, perm: "expenses.manage" },
      { href: "/reports", label: "Reports", hint: "Excel and PDF exports", icon: FileSpreadsheet, perm: "reports.view" },
    ],
  },
  {
    id: "system", title: "System", icon: Cog,
    items: [{ href: "/settings", label: "Settings", hint: "Business, fence, logins", icon: Cog, perm: "settings.manage" }],
  },
];

export function navFor(perms: Permission[], role: string) {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => perms.includes(i.perm) && !(i.staffOnly && role !== "STAFF") && !(i.hideForStaff && role === "STAFF")),
  })).filter((g) => g.items.length);
}

export const groupOf = (path: string) => NAV.find((g) => g.items.some((i) => path === i.href || path.startsWith(`${i.href}/`)));
