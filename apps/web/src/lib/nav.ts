import type { Permission } from "@pp/shared";
import {
  LayoutDashboard, LineChart, ShoppingBag, Undo2, Scale, ReceiptIndianRupee, Package, Boxes, Truck, Fingerprint, Users,
  ListChecks, CalendarHeart, Wallet, PiggyBank, FileSpreadsheet, Settings, Sun, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; bn: string; icon: LucideIcon; perm: Permission; staffOnly?: boolean; hideForStaff?: boolean }
export interface NavSection { title: string; items: NavItem[] }

export const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/me", label: "My Day", bn: "আমার দিন", icon: Sun, perm: "attendance.self", staffOnly: true },
      { href: "/dashboard", label: "Dashboard", bn: "এক নজরে", icon: LayoutDashboard, perm: "dashboard.view", hideForStaff: true },
      { href: "/analytics", label: "Analytics", bn: "বিশ্লেষণ", icon: LineChart, perm: "analytics.view" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { href: "/orders", label: "Orders & Dispatch", bn: "অর্ডার", icon: ShoppingBag, perm: "orders.view" },
      { href: "/returns", label: "Returns", bn: "ফেরত", icon: Undo2, perm: "returns.manage" },
      { href: "/reconciliation", label: "Settlements", bn: "হিসাব মেলানো", icon: Scale, perm: "orders.import" },
      { href: "/billing", label: "GST Billing", bn: "বিল", icon: ReceiptIndianRupee, perm: "billing.manage" },
    ],
  },
  {
    title: "Warehouse",
    items: [
      { href: "/products", label: "Products & SKUs", bn: "পণ্য", icon: Package, perm: "products.view" },
      { href: "/stock", label: "Stock", bn: "মজুত", icon: Boxes, perm: "stock.view" },
      { href: "/purchases", label: "Purchases", bn: "কেনাকাটা", icon: Truck, perm: "purchases.manage" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/hr/attendance", label: "Attendance", bn: "হাজিরা", icon: Fingerprint, perm: "attendance.view" },
      { href: "/hr/employees", label: "Team", bn: "কর্মী", icon: Users, perm: "employees.view" },
      { href: "/hr/tasks", label: "Tasks", bn: "কাজ", icon: ListChecks, perm: "tasks.manage" },
      { href: "/hr/leave", label: "Leave", bn: "ছুটি", icon: CalendarHeart, perm: "leave.approve" },
      { href: "/hr/payroll", label: "Payroll", bn: "বেতন", icon: Wallet, perm: "payroll.manage" },
    ],
  },
  {
    title: "Books",
    items: [
      { href: "/expenses", label: "Expenses", bn: "খরচ", icon: PiggyBank, perm: "expenses.manage" },
      { href: "/reports", label: "Reports", bn: "রিপোর্ট", icon: FileSpreadsheet, perm: "reports.view" },
      { href: "/settings", label: "Settings", bn: "সেটিংস", icon: Settings, perm: "settings.manage" },
    ],
  },
];

export function navFor(perms: Permission[], role: string) {
  return NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => perms.includes(i.perm) && !(i.staffOnly && role !== "STAFF") && !(i.hideForStaff && role === "STAFF")),
  })).filter((s) => s.items.length);
}
