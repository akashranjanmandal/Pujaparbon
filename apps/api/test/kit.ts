import request from "supertest";
import { createApp } from "../src/app";
import { db } from "../src/db/client";
import { employees, tenants, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";

export const app = createApp();
export const api = () => request(app);

export const FENCE = { lat: 22.2889, lng: 88.2633 };
const PASSWORD = "Test@12345";
const atShop = { lat: FENCE.lat, lng: FENCE.lng };

/** An isolated business: an owner, one employee (with a login), and the hub location. */
export async function makeTenant(tag = Math.random().toString(36).slice(2, 8)) {
  const [t] = await db.insert(tenants).values({ name: `Test ${tag}`, slug: `t-${tag}`, geofenceLat: FENCE.lat, geofenceLng: FENCE.lng, geofenceRadiusM: 100 }).returning();
  const [emp] = await db.insert(employees).values({ tenantId: t.id, code: "E1", name: "Rina Das", phone: "9000000000", designation: "Helper", joinDate: "2026-01-01" }).returning();
  const hash = await hashPassword(PASSWORD);
  const [owner] = await db.insert(users).values({ tenantId: t.id, name: `Owner ${tag}`, email: `owner-${tag}@test.in`, passwordHash: hash, role: "OWNER" }).returning();
  const [staff] = await db.insert(users).values({ tenantId: t.id, name: `Staff ${tag}`, email: `staff-${tag}@test.in`, passwordHash: hash, role: "STAFF", employeeId: emp.id }).returning();
  const token = async (u: { email: string }) => (await api().post("/api/v1/auth/login").send({ email: u.email, password: PASSWORD, location: { ...atShop, accuracyM: 10 } })).body.accessToken as string;
  const [ownerT, staffT] = await Promise.all([token(owner), token(staff)]);
  const biz = (await api().get("/api/v1/businesses").set("Authorization", `Bearer ${ownerT}`)).body as { id: string; kind: string; name: string }[];
  const online = biz.find((b) => b.kind === "ONLINE")!.id;
  /**
   * A client for one login. With `def` it names a business on every call that does not name one itself,
   * the way the app always does. Without it nothing is filled in, so strictness can be tested.
   */
  const as = (tok: string, def?: string) => {
    const call = (method: "get" | "post" | "put" | "patch" | "delete", url: string) => {
      const u = def && method === "get" && !/businessId=/.test(url) ? `${url}${url.includes("?") ? "&" : "?"}businessId=${def}` : url;
      const r = api()[method](u).set("Authorization", `Bearer ${tok}`);
      if (def && method !== "get" && method !== "delete") {
        const send = r.send.bind(r);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r as any).send = (b: any) => send(b && typeof b === "object" && !Array.isArray(b) && !("businessId" in b) ? { ...b, businessId: def } : b);
      }
      return r;
    };
    return { get: (u: string) => call("get", u), post: (u: string) => call("post", u), put: (u: string) => call("put", u), patch: (u: string) => call("patch", u), del: (u: string) => call("delete", u) };
  };
  return { tenant: t, tag, owner, staff, emp, password: PASSWORD, biz, online, asOwner: as(ownerT, online), rawOwner: as(ownerT), asStaff: as(staffT, online) };
}

export type Tenant = Awaited<ReturnType<typeof makeTenant>>;

/** A tiny but valid JPEG (SOI marker + padding) for selfie uploads. */
export const SELFIE = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1500, 1)]).toString("base64")}`;
