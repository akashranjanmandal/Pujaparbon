import { sql } from "drizzle-orm";
import { blob, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Seller OS schema (libSQL / Turso).
 * Rules: every business row carries tenantId; money is integer paise; dates are IST "YYYY-MM-DD" text;
 * stock is a ledger (stock_movements) with a paise value on every row, so stock value is always SUM(value).
 */

const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const tenant = () => text("tenant_id").notNull().references(() => tenants.id);
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

export const tenants = sqliteTable("tenants", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  geofenceLat: real("geofence_lat").notNull(),
  geofenceLng: real("geofence_lng").notNull(),
  geofenceRadiusM: integer("geofence_radius_m").notNull().default(100),
  shiftStart: text("shift_start").notNull().default("10:00"),
  shiftEnd: text("shift_end").notNull().default("19:00"),
  lateGraceMin: integer("late_grace_min").notNull().default(10),
  selfieRetentionDays: integer("selfie_retention_days").notNull().default(90),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: pk(),
    tenantId: tenant(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["OWNER", "STAFF"] }).notNull(),
    employeeId: text("employee_id"),
    deviceId: text("device_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: pk(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

/** A thing he sells. Category is free text: he creates categories simply by typing them. */
export const products = sqliteTable(
  "products",
  {
    id: pk(),
    tenantId: tenant(),
    /** Short code printed in the QR, e.g. P7K2MX. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unit: text("unit").notNull().default("pcs"),
    sellingPricePaise: integer("selling_price_paise").notNull().default(0),
    notes: text("notes"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("products_code_uq").on(t.tenantId, t.code), index("products_tenant_idx").on(t.tenantId, t.category)],
);

/** Every unit in and out. valuePaise is signed like qty, so SUM(valuePaise) is the stock value at cost. */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: pk(),
    tenantId: tenant(),
    productId: text("product_id").notNull().references(() => products.id),
    qty: integer("qty").notNull(),
    valuePaise: integer("value_paise").notNull(),
    type: text("type", { enum: ["OPENING", "BUY", "COUNT"] }).notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    note: text("note"),
    userId: text("user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("moves_product_idx").on(t.tenantId, t.productId), index("moves_ref_idx").on(t.refType, t.refId)],
);

/** One trip to the market: items bought plus everything it cost to bring them home. */
export const trips = sqliteTable(
  "trips",
  {
    id: pk(),
    tenantId: tenant(),
    /** QR code for the whole lot, e.g. L9QX3T. */
    code: text("code").notNull(),
    date: text("date").notNull(),
    title: text("title"),
    place: text("place"),
    notes: text("notes"),
    basis: text("basis", { enum: ["VALUE", "QTY"] }).notNull().default("VALUE"),
    itemsPaise: integer("items_paise").notNull(),
    costsPaise: integer("costs_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("trips_code_uq").on(t.tenantId, t.code), index("trips_date_idx").on(t.tenantId, t.date)],
);

export const tripItems = sqliteTable("trip_items", {
  id: pk(),
  tripId: text("trip_id").notNull().references(() => trips.id),
  productId: text("product_id").notNull().references(() => products.id),
  qty: integer("qty").notNull(),
  /** What he paid at the market for this line. */
  linePaise: integer("line_paise").notNull(),
  /** Share of the trip costs given to this line. */
  extraPaise: integer("extra_paise").notNull(),
  landedPaise: integer("landed_paise").notNull(),
  unitCostPaise: integer("unit_cost_paise").notNull(),
  unitPricePaise: integer("unit_price_paise").notNull(),
});

export const tripCosts = sqliteTable("trip_costs", {
  id: pk(),
  tripId: text("trip_id").notNull().references(() => trips.id),
  kind: text("kind").notNull(),
  label: text("label"),
  amountPaise: integer("amount_paise").notNull(),
  paidBy: text("paid_by"),
});

/** Money put in outside a buying trip: a weighing scale, packing material, rent... */
export const investments = sqliteTable(
  "investments",
  {
    id: pk(),
    tenantId: tenant(),
    date: text("date").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    note: text("note"),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [index("investments_date_idx").on(t.tenantId, t.date)],
);

/** A marketplace he sells on. columnMap remembers how its report columns match our fields. */
export const platforms = sqliteTable(
  "platforms",
  {
    id: pk(),
    tenantId: tenant(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    columnMap: text("column_map", { mode: "json" }).$type<Record<string, string>>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("platforms_name_uq").on(t.tenantId, t.name)],
);

/** An uploaded monthly sales report or invoice. The original file is kept so it can be downloaded again. */
export const platformReports = sqliteTable(
  "platform_reports",
  {
    id: pk(),
    tenantId: tenant(),
    platformId: text("platform_id").notNull().references(() => platforms.id),
    kind: text("kind", { enum: ["SALES", "INVOICE"] }).notNull(),
    month: text("month").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    data: blob("data", { mode: "buffer" }),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsImported: integer("rows_imported").notNull().default(0),
    rowsSkipped: integer("rows_skipped").notNull().default(0),
    amountPaise: integer("amount_paise"),
    note: text("note"),
    errors: text("errors", { mode: "json" }).$type<{ row: number; message: string }[]>(),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_platform_idx").on(t.platformId, t.month)],
);

export const platformSales = sqliteTable(
  "platform_sales",
  {
    id: pk(),
    tenantId: tenant(),
    platformId: text("platform_id").notNull().references(() => platforms.id),
    reportId: text("report_id").notNull().references(() => platformReports.id),
    /** Order id (+ line number) so re-uploading the same report never counts a sale twice. */
    lineKey: text("line_key").notNull(),
    orderId: text("order_id"),
    orderDate: text("order_date").notNull(),
    productName: text("product_name").notNull(),
    sku: text("sku"),
    productId: text("product_id").references(() => products.id),
    qty: integer("qty").notNull(),
    grossPaise: integer("gross_paise").notNull(),
    feesPaise: integer("fees_paise").notNull().default(0),
    /** What the platform actually paid out for this line. */
    netPaise: integer("net_paise").notNull(),
    state: text("state"),
    status: text("status", { enum: ["DELIVERED", "RETURNED", "CANCELLED"] }).notNull(),
    /** Estimated cost of the goods sold (average landed cost at import time). */
    costPaise: integer("cost_paise").notNull().default(0),
  },
  (t) => [
    uniqueIndex("sales_line_uq").on(t.platformId, t.lineKey),
    index("sales_date_idx").on(t.tenantId, t.orderDate),
    index("sales_report_idx").on(t.reportId),
  ],
);

/** "This name on Flipkart is that product of mine" — remembered so later reports match by themselves. */
export const productAliases = sqliteTable(
  "product_aliases",
  {
    id: pk(),
    tenantId: tenant(),
    platformId: text("platform_id").notNull().references(() => platforms.id),
    alias: text("alias").notNull(),
    productId: text("product_id").notNull().references(() => products.id),
  },
  (t) => [uniqueIndex("alias_uq").on(t.platformId, t.alias)],
);

export const employees = sqliteTable(
  "employees",
  {
    id: pk(),
    tenantId: tenant(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    designation: text("designation").notNull(),
    joinDate: text("join_date").notNull(),
    shiftStart: text("shift_start").notNull().default("10:00"),
    avatarHue: integer("avatar_hue").notNull().default(20),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("employees_code_uq").on(t.tenantId, t.code)],
);

export const attendance = sqliteTable(
  "attendance",
  {
    id: pk(),
    tenantId: tenant(),
    employeeId: text("employee_id").notNull().references(() => employees.id),
    date: text("date").notNull(),
    status: text("status", { enum: ["PRESENT", "LATE", "HALF_DAY", "ABSENT"] }).notNull(),
    checkInAt: integer("check_in_at", { mode: "timestamp_ms" }),
    checkOutAt: integer("check_out_at", { mode: "timestamp_ms" }),
    checkInDistanceM: integer("check_in_distance_m"),
    checkOutDistanceM: integer("check_out_distance_m"),
    /** Selfies live in the database so they survive restarts on free hosting. */
    checkInPhoto: blob("check_in_photo", { mode: "buffer" }),
    checkOutPhoto: blob("check_out_photo", { mode: "buffer" }),
    deviceId: text("device_id"),
    source: text("source", { enum: ["GEOFENCE", "MANUAL"] }).notNull().default("GEOFENCE"),
  },
  (t) => [uniqueIndex("attendance_day_uq").on(t.employeeId, t.date), index("attendance_date_idx").on(t.tenantId, t.date)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: pk(),
    tenantId: tenant(),
    userId: text("user_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("audit_created_idx").on(t.tenantId, t.createdAt)],
);
