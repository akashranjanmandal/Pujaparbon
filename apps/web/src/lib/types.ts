import type { Permission, Role } from "@pp/shared";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  designation: string;
  avatarHue: number;
  tenant: { name: string; state: string } | null;
  permissions: Permission[];
}

export interface Channel { code: string; name: string; color: string }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
