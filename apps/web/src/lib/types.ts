import type { Permission, Role } from "@pp/shared";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  designation: string;
  avatarHue: number;
  tenant: { name: string } | null;
  permissions: Permission[];
}

export interface Business { id: string; name: string; kind: "CLAY" | "FISH" | "MELA" | "PAINT" | "ONLINE"; color: string }
export interface Place { id: string; name: string; kind: "SHOP" | "HAAT" | "MELA" | "WAREHOUSE" | "ONLINE"; businessId: string | null; days: string[]; active: boolean }
