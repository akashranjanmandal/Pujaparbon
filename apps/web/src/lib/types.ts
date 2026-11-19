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
