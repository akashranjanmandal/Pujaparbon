import type { Permission } from "@pp/shared";
import { Boxes, Cog, Fingerprint, Home, LineChart, ShoppingBasket, Store, Users, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; hint: string; icon: LucideIcon; perm: Permission; key?: string }
export interface NavGroup { id: string; title: string; icon: LucideIcon; items: NavItem[] }

/** Two kinds of people use the app: the owner (everything) and employees (their shift). */
export const NAV: NavGroup[] = [
  { id: "me", title: "My shift", icon: Fingerprint, items: [{ href: "/me", label: "My shift", hint: "Check in and out", icon: Fingerprint, perm: "attendance.self" }] },
  { id: "home", title: "Home", icon: Home, items: [{ href: "/dashboard", label: "Home", hint: "Profit, stock and what needs you", icon: Home, perm: "dashboard.view", key: "g h" }] },
  {
    id: "buy", title: "Buy", icon: ShoppingBasket,
    items: [
      { href: "/buy/new", label: "New buy", hint: "Record a market trip and set prices", icon: ShoppingBasket, perm: "buy.manage", key: "g b" },
      { href: "/buy", label: "Buy history", hint: "Every trip and what it cost", icon: ShoppingBasket, perm: "buy.manage" },
    ],
  },
  {
    id: "stock", title: "Stock", icon: Boxes,
    items: [
      { href: "/stock", label: "Stock", hint: "What you have, and update counts", icon: Boxes, perm: "stock.view", key: "g s" },
    ],
  },
  { id: "platforms", title: "Platforms", icon: Store, items: [{ href: "/platforms", label: "Platforms", hint: "Monthly reports and invoices", icon: Store, perm: "platforms.manage", key: "g p" }] },
  {
    id: "money", title: "Money", icon: LineChart,
    items: [
      { href: "/analytics", label: "Profit & analytics", hint: "Any week, month or custom range", icon: LineChart, perm: "analytics.view", key: "g a" },
      { href: "/investments", label: "Investments", hint: "Everything you have put in", icon: LineChart, perm: "investments.manage" },
      { href: "/reports", label: "Reports", hint: "Excel and PDF downloads", icon: LineChart, perm: "reports.view" },
    ],
  },
  {
    id: "team", title: "Team", icon: Users,
    items: [
      { href: "/hr/attendance", label: "Attendance", hint: "Who is in, with selfies", icon: Users, perm: "attendance.view" },
      { href: "/hr/employees", label: "Employees", hint: "People and their logins", icon: Users, perm: "employees.manage" },
    ],
  },
  { id: "system", title: "Settings", icon: Cog, items: [{ href: "/settings", label: "Settings", hint: "Business, location and password", icon: Cog, perm: "settings.manage" }] },
];

/** Employees see "My shift"; the owner sees the rest. */
export function navFor(perms: Permission[], role: string) {
  const out = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => perms.includes(i.perm) && !(i.href === "/me" && role !== "STAFF")),
  })).filter((g) => g.items.length);
  return out;
}

export const groupOf = (path: string) => NAV.find((g) => g.items.some((i) => path === i.href || path.startsWith(`${i.href}/`)));
