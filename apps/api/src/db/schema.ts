import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Seller OS schema (libSQL / Turso).
 * Rules: every business row carries tenantId; money is integer paise; stock is a ledger (stock_movements).
 */

const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const tenant = () => text("tenant_id").notNull().references(() => tenants.id);
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

export const tenants = sqliteTable("tenants", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  gstin: text("gstin"),
  address: text("address"),
  state: text("state").notNull().default("West Bengal"),
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
    role: text("role", { enum: ["OWNER", "MANAGER", "STAFF"] }).notNull(),
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

export const channels = sqliteTable(
  "channels",
  {
    id: pk(),
    tenantId: tenant(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [uniqueIndex("channels_code_uq").on(t.tenantId, t.code)],
);

export const products = sqliteTable(
  "products",
  {
    id: pk(),
    tenantId: tenant(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    hsnCode: text("hsn_code").notNull(),
    gstRate: integer("gst_rate").notNull(),
    emoji: text("emoji"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("products_tenant_idx").on(t.tenantId)],
);

export const variants = sqliteTable(
  "variants",
  {
    id: pk(),
    tenantId: tenant(),
    productId: text("product_id").notNull().references(() => products.id),
    sku: text("sku").notNull(),
    size: text("size"),
    color: text("color"),
    mrpPaise: integer("mrp_paise").notNull(),
    pricePaise: integer("price_paise").notNull(),
    costPaise: integer("cost_paise").notNull(),
    reorderLevel: integer("reorder_level").notNull().default(5),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("variants_sku_uq").on(t.tenantId, t.sku), index("variants_product_idx").on(t.productId)],
);

export const channelListings = sqliteTable(
  "channel_listings",
  {
    id: pk(),
    tenantId: tenant(),
    variantId: text("variant_id").notNull().references(() => variants.id),
    channelId: text("channel_id").notNull().references(() => channels.id),
    channelSku: text("channel_sku").notNull(),
    listingId: text("listing_id"),
  },
  (t) => [uniqueIndex("listing_channel_sku_uq").on(t.tenantId, t.channelId, t.channelSku)],
);

export const bins = sqliteTable(
  "bins",
  {
    id: pk(),
    tenantId: tenant(),
    code: text("code").notNull(),
    zone: text("zone").notNull(),
  },
  (t) => [uniqueIndex("bins_code_uq").on(t.tenantId, t.code)],
);

/** Immutable ledger. Current stock = SUM(qty) per variant (and per bin). */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: pk(),
    tenantId: tenant(),
    variantId: text("variant_id").notNull().references(() => variants.id),
    binId: text("bin_id").references(() => bins.id),
    qty: integer("qty").notNull(),
    type: text("type", {
      enum: ["PURCHASE", "INWARD", "SALE", "OUTWARD", "RETURN", "ADJUSTMENT", "TRANSFER"],
    }).notNull(),
    reason: text("reason"),
    refType: text("ref_type"),
    refId: text("ref_id"),
    userId: text("user_id"),
    createdAt: createdAt(),
  },
  (t) => [index("moves_variant_idx").on(t.tenantId, t.variantId), index("moves_created_idx").on(t.tenantId, t.createdAt)],
);

export const suppliers = sqliteTable("suppliers", {
  id: pk(),
  tenantId: tenant(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  gstin: text("gstin"),
  city: text("city"),
  createdAt: createdAt(),
});

export const purchases = sqliteTable("purchases", {
  id: pk(),
  tenantId: tenant(),
  supplierId: text("supplier_id").notNull().references(() => suppliers.id),
  number: text("number").notNull(),
  invoiceNo: text("invoice_no").notNull(),
  date: text("date").notNull(),
  totalPaise: integer("total_paise").notNull(),
  notes: text("notes"),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

export const purchaseItems = sqliteTable("purchase_items", {
  id: pk(),
  purchaseId: text("purchase_id").notNull().references(() => purchases.id),
  variantId: text("variant_id").notNull().references(() => variants.id),
  qty: integer("qty").notNull(),
  costPaise: integer("cost_paise").notNull(),
  binId: text("bin_id"),
});

export const customers = sqliteTable("customers", {
  id: pk(),
  tenantId: tenant(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  createdAt: createdAt(),
});

export const importBatches = sqliteTable("import_batches", {
  id: pk(),
  tenantId: tenant(),
  channelId: text("channel_id").notNull().references(() => channels.id),
  kind: text("kind", { enum: ["ORDERS", "SETTLEMENTS"] }).notNull(),
  fileName: text("file_name").notNull(),
  rowsTotal: integer("rows_total").notNull(),
  rowsImported: integer("rows_imported").notNull(),
  rowsSkipped: integer("rows_skipped").notNull(),
  errors: text("errors", { mode: "json" }).$type<{ row: number; message: string }[]>().notNull(),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

export const orders = sqliteTable(
  "orders",
  {
    id: pk(),
    tenantId: tenant(),
    channelId: text("channel_id").notNull().references(() => channels.id),
    channelOrderId: text("channel_order_id").notNull(),
    customerId: text("customer_id"),
    customerName: text("customer_name").notNull(),
    city: text("city"),
    state: text("state"),
    status: text("status", {
      enum: ["NEW", "PICKED", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED", "RETURNED"],
    }).notNull(),
    orderedAt: integer("ordered_at", { mode: "timestamp_ms" }).notNull(),
    dispatchBy: integer("dispatch_by", { mode: "timestamp_ms" }),
    dispatchedAt: integer("dispatched_at", { mode: "timestamp_ms" }),
    awb: text("awb"),
    totalPaise: integer("total_paise").notNull(),
    feesPaise: integer("fees_paise").notNull().default(0),
    settledPaise: integer("settled_paise"),
    settledAt: integer("settled_at", { mode: "timestamp_ms" }),
    importBatchId: text("import_batch_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("orders_channel_uq").on(t.tenantId, t.channelId, t.channelOrderId),
    index("orders_status_idx").on(t.tenantId, t.status),
    index("orders_date_idx").on(t.tenantId, t.orderedAt),
  ],
);

export const orderItems = sqliteTable("order_items", {
  id: pk(),
  orderId: text("order_id").notNull().references(() => orders.id),
  variantId: text("variant_id").references(() => variants.id),
  channelSku: text("channel_sku").notNull(),
  qty: integer("qty").notNull(),
  pricePaise: integer("price_paise").notNull(),
});

export const returns = sqliteTable("returns", {
  id: pk(),
  tenantId: tenant(),
  orderId: text("order_id").notNull().references(() => orders.id),
  variantId: text("variant_id").notNull().references(() => variants.id),
  qty: integer("qty").notNull(),
  type: text("type", { enum: ["CUSTOMER", "RTO"] }).notNull(),
  condition: text("condition", { enum: ["GOOD", "DAMAGED"] }).notNull(),
  status: text("status", { enum: ["RECEIVED", "RESTOCKED", "WRITTEN_OFF"] }).notNull(),
  reason: text("reason").notNull(),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

export const employees = sqliteTable(
  "employees",
  {
    id: pk(),
    tenantId: tenant(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    designation: text("designation").notNull(),
    department: text("department").notNull(),
    joinDate: text("join_date").notNull(),
    monthlySalaryPaise: integer("monthly_salary_paise").notNull(),
    shiftStart: text("shift_start").notNull().default("10:00"),
    avatarHue: integer("avatar_hue").notNull().default(20),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("employees_code_uq").on(t.tenantId, t.code)],
);

export const tasks = sqliteTable("tasks", {
  id: pk(),
  tenantId: tenant(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH"] }).notNull(),
  status: text("status", { enum: ["TODO", "IN_PROGRESS", "DONE"] }).notNull().default("TODO"),
  note: text("note"),
  createdById: text("created_by_id"),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const attendance = sqliteTable(
  "attendance",
  {
    id: pk(),
    tenantId: tenant(),
    employeeId: text("employee_id").notNull().references(() => employees.id),
    date: text("date").notNull(),
    status: text("status", { enum: ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "LEAVE"] }).notNull(),
    checkInAt: integer("check_in_at", { mode: "timestamp_ms" }),
    checkOutAt: integer("check_out_at", { mode: "timestamp_ms" }),
    checkInDistanceM: integer("check_in_distance_m"),
    checkOutDistanceM: integer("check_out_distance_m"),
    checkInSelfie: text("check_in_selfie"),
    checkOutSelfie: text("check_out_selfie"),
    deviceId: text("device_id"),
    source: text("source", { enum: ["GEOFENCE", "MANUAL"] }).notNull().default("GEOFENCE"),
  },
  (t) => [uniqueIndex("attendance_day_uq").on(t.employeeId, t.date), index("attendance_date_idx").on(t.tenantId, t.date)],
);

export const leaves = sqliteTable("leaves", {
  id: pk(),
  tenantId: tenant(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  type: text("type", { enum: ["CASUAL", "SICK", "EARNED", "UNPAID"] }).notNull(),
  from: text("from_date").notNull(),
  to: text("to_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
  decidedById: text("decided_by_id"),
  createdAt: createdAt(),
});

export const holidays = sqliteTable("holidays", {
  id: pk(),
  tenantId: tenant(),
  date: text("date").notNull(),
  name: text("name").notNull(),
});

export const payslips = sqliteTable(
  "payslips",
  {
    id: pk(),
    tenantId: tenant(),
    employeeId: text("employee_id").notNull().references(() => employees.id),
    month: text("month").notNull(),
    workingDays: integer("working_days").notNull(),
    presentDays: real("present_days").notNull(),
    paidLeaveDays: integer("paid_leave_days").notNull(),
    lateCount: integer("late_count").notNull(),
    payableDays: real("payable_days").notNull(),
    basePaise: integer("base_paise").notNull(),
    grossPaise: integer("gross_paise").notNull(),
    advancePaise: integer("advance_paise").notNull(),
    netPaise: integer("net_paise").notNull(),
    status: text("status", { enum: ["DRAFT", "PAID"] }).notNull().default("DRAFT"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payslip_month_uq").on(t.employeeId, t.month)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: pk(),
    tenantId: tenant(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    channelId: text("channel_id"),
    customerName: text("customer_name").notNull(),
    customerGstin: text("customer_gstin"),
    placeOfSupply: text("place_of_supply").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    cgstPaise: integer("cgst_paise").notNull(),
    sgstPaise: integer("sgst_paise").notNull(),
    igstPaise: integer("igst_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    status: text("status", { enum: ["ISSUED", "CANCELLED"] }).notNull().default("ISSUED"),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invoice_number_uq").on(t.tenantId, t.number)],
);

export const invoiceItems = sqliteTable("invoice_items", {
  id: pk(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id),
  variantId: text("variant_id"),
  description: text("description").notNull(),
  hsn: text("hsn").notNull(),
  qty: integer("qty").notNull(),
  ratePaise: integer("rate_paise").notNull(),
  gstRate: integer("gst_rate").notNull(),
  taxablePaise: integer("taxable_paise").notNull(),
  taxPaise: integer("tax_paise").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: pk(),
  tenantId: tenant(),
  date: text("date").notNull(),
  category: text("category").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  note: text("note"),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
});

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
