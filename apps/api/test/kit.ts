import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/db/client";
import { employees, tenants, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

export const app = createApp();
export const api = () => request(app);

export const FENCE = { lat: 22.2889, lng: 88.2633 };
const PASSWORD = "Test@12345";

/** An isolated business: an owner, one employee (with a login), and the hub location. */
export async function makeTenant(tag = Math.random().toString(36).slice(2, 8)) {
  const [t] = await db.insert(tenants).values({ name: `Test ${tag}`, slug: `t-${tag}`, geofenceLat: FENCE.lat, geofenceLng: FENCE.lng, geofenceRadiusM: 100 }).returning();
  const [emp] = await db.insert(employees).values({ tenantId: t.id, code: "E1", name: "Rina Das", phone: "9000000000", designation: "Helper", joinDate: "2026-01-01" }).returning();
  const hash = await hashPassword(PASSWORD);
  const [owner] = await db.insert(users).values({ tenantId: t.id, name: `Owner ${tag}`, email: `owner-${tag}@test.in`, passwordHash: hash, role: "OWNER" }).returning();
  const [staff] = await db.insert(users).values({ tenantId: t.id, name: `Staff ${tag}`, email: `staff-${tag}@test.in`, passwordHash: hash, role: "STAFF", employeeId: emp.id }).returning();
  const token = async (u: { email: string }) => (await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD })).body.accessToken as string;
  const [ownerT, staffT] = await Promise.all([token(owner), token(staff)]);
  const as = (tok: string) => ({
    get: (url: string) => api().get(url).set("Authorization", `Bearer ${tok}`),
    post: (url: string) => api().post(url).set("Authorization", `Bearer ${tok}`),
    put: (url: string) => api().put(url).set("Authorization", `Bearer ${tok}`),
    patch: (url: string) => api().patch(url).set("Authorization", `Bearer ${tok}`),
    del: (url: string) => api().delete(url).set("Authorization", `Bearer ${tok}`),
  });
  return { tenant: t, tag, owner, staff, emp, password: PASSWORD, asOwner: as(ownerT), asStaff: as(staffT) };
}

export type Tenant = Awaited<ReturnType<typeof makeTenant>>;

/** A tiny but valid JPEG (SOI marker + padding) for selfie uploads. */
export const SELFIE = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1500, 1)]).toString("base64")}`;
