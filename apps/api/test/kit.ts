import request from "supertest";
import { CHANNELS } from "@pp/shared";
import { createApp } from "../src/app";
import { db } from "../src/db/client";
import { bins, channels, employees, products, tenants, users, variants, channelListings } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

export const app = createApp();
export const api = () => request(app);

export const FENCE = { lat: 22.2889, lng: 88.2633 };
const PASSWORD = "Test@12345";

/** A complete, isolated business: owner, manager, staff (linked to an employee), channels, one product, one bin. */
export async function makeTenant(tag = Math.random().toString(36).slice(2, 8)) {
  const [t] = await db.insert(tenants).values({ name: `Test ${tag}`, slug: `t-${tag}`, geofenceLat: FENCE.lat, geofenceLng: FENCE.lng, geofenceRadiusM: 100 }).returning();
  const chans = await db.insert(channels).values(CHANNELS.map((c) => ({ tenantId: t.id, code: c.code, name: c.name, color: c.color }))).returning();
  const [emp] = await db.insert(employees).values({ tenantId: t.id, code: "E1", name: "Rina Das", phone: "9000000000", designation: "Picker", department: "Warehouse", joinDate: "2026-01-01", monthlySalaryPaise: 1500000 }).returning();
  const hash = await hashPassword(PASSWORD);
  const mk = (role: "OWNER" | "MANAGER" | "STAFF") =>
    db.insert(users).values({ tenantId: t.id, name: `${role} ${tag}`, email: `${role.toLowerCase()}-${tag}@test.in`, passwordHash: hash, role, employeeId: role === "STAFF" ? emp.id : null }).returning();
  const [[owner], [manager], [staff]] = await Promise.all([mk("OWNER"), mk("MANAGER"), mk("STAFF")]);
  const [p] = await db.insert(products).values({ tenantId: t.id, name: "Tant Saree", category: "Sarees", hsnCode: "5208", gstRate: 5 }).returning();
  const [v] = await db.insert(variants).values({ tenantId: t.id, productId: p.id, sku: `TANT-${tag}`.toUpperCase(), mrpPaise: 150000, pricePaise: 105000, costPaise: 60000, reorderLevel: 3 }).returning();
  const fk = chans.find((c) => c.code === "FLIPKART")!;
  await db.insert(channelListings).values({ tenantId: t.id, variantId: v.id, channelId: fk.id, channelSku: `FK-${tag}`.toUpperCase() });
  const [bin] = await db.insert(bins).values({ tenantId: t.id, code: "A-01", zone: "Sarees" }).returning();

  const token = async (u: { email: string }) => (await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD })).body.accessToken as string;
  const [ownerT, managerT, staffT] = await Promise.all([token(owner), token(manager), token(staff)]);
  const as = (tok: string) => ({
    get: (url: string) => api().get(url).set("Authorization", `Bearer ${tok}`),
    post: (url: string) => api().post(url).set("Authorization", `Bearer ${tok}`),
    put: (url: string) => api().put(url).set("Authorization", `Bearer ${tok}`),
    patch: (url: string) => api().patch(url).set("Authorization", `Bearer ${tok}`),
  });
  return { tenant: t, tag, owner, manager, staff, emp, product: p, variant: v, bin, fkSku: `FK-${tag}`.toUpperCase(), password: PASSWORD, asOwner: as(ownerT), asManager: as(managerT), asStaff: as(staffT) };
}

/** A tiny but valid JPEG (SOI marker + padding) for selfie uploads. */
export const SELFIE = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1500, 1)]).toString("base64")}`;
