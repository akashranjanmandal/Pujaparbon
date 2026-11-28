import type { BusinessKind, Permission } from "@pp/shared";
import { Boxes, Cog, FileWarning, Paintbrush, Truck, HandCoins, MapPin, PackageX, Receipt, Scale, Fingerprint, Home, LineChart, Package, ShoppingBasket, Store, Users, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; hint: string; icon: LucideIcon; perm: Permission; key?: string; /** Only shown when one of these businesses is open (always shown when viewing all). */ kinds?: BusinessKind[] }
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
      { href: "/batches", label: "Make & process", hint: "Painting, colouring and packing batches", icon: Paintbrush, perm: "stock.view", kinds: ["PAINT"] },
      { href: "/places", label: "Stock by place", hint: "Shop, haats, warehouse, and moving goods", icon: MapPin, perm: "stock.view" },
    ],
  },
  {
    id: "sell", title: "Sell", icon: Receipt,
    items: [
      { href: "/sell", label: "Sell", hint: "Shop, haat, mela and wholesale sales", icon: Receipt, perm: "sales.manage", key: "g l" },
      { href: "/dues", label: "Dues", hint: "Who owes you, whom you owe", icon: HandCoins, perm: "dues.manage" },
      { href: "/losses", label: "Returns & losses", hint: "Returns, waste and spoiled stock", icon: PackageX, perm: "losses.manage" },
    ],
  },
  { id: "packaging", title: "Packing", icon: Package, items: [{ href: "/packaging", label: "Packing", hint: "Items to pack and packing materials", icon: Package, perm: "packaging.view", key: "g k" }] },
  { id: "platforms", title: "Platforms", icon: Store, items: [{ href: "/platforms", label: "Platforms", hint: "Sales reports and invoices", icon: Store, perm: "platforms.manage", key: "g p", kinds: ["ONLINE"] }, { href: "/couriers", label: "Courier movement", hint: "Parcels out, returns and RTO by courier", icon: Truck, perm: "platforms.manage", kinds: ["ONLINE"] }, { href: "/claims", label: "Claims", hint: "Damaged and wrong returns, and what was paid", icon: FileWarning, perm: "platforms.manage", kinds: ["ONLINE"] }] },
  {
    id: "money", title: "Money", icon: LineChart,
    items: [
      { href: "/accounts", label: "Business accounts", hint: "Profit for each business and combined", icon: Scale, perm: "accounts.view", key: "g c" },
      { href: "/analytics", label: "Profit & analytics", hint: "Any week, month or custom range", icon: LineChart, perm: "analytics.view", key: "g a" },
      { href: "/investments", label: "Investments", hint: "Everything you have put in", icon: LineChart, perm: "investments.manage" },
      { href: "/reports", label: "Reports", hint: "Excel and PDF downloads", icon: LineChart, perm: "reports.view" },
    ],
  },
  {
    id: "team", title: "Team", icon: Users,
    items: [
      { href: "/hr/attendance", label: "Attendance", hint: "Who is in, with selfies", icon: Users, perm: "attendance.view" },
      { href: "/hr/payroll", label: "Salary", hint: "Who to pay this month, and how much", icon: Users, perm: "payroll.manage" },
      { href: "/hr/employees", label: "Employees", hint: "People and their logins", icon: Users, perm: "employees.manage" },
    ],
  },
  { id: "system", title: "Settings", icon: Cog, items: [{ href: "/settings", label: "Settings", hint: "Business, location and password", icon: Cog, perm: "settings.manage" }] },
];

/** Employees see "My shift"; the owner sees the rest. */
export function navFor(perms: Permission[], role: string, kind?: BusinessKind) {
  const out = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => perms.includes(i.perm) && !(i.href === "/me" && role !== "STAFF") && (!kind || !i.kinds || i.kinds.includes(kind))),
  })).filter((g) => g.items.length);
  return out;
}

export const groupOf = (path: string) => NAV.find((g) => g.items.some((i) => path === i.href || path.startsWith(`${i.href}/`)));
