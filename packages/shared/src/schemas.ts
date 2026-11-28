import { z } from "zod";
import { BUSINESS_KINDS, ENTRY_KINDS, LOCATION_KINDS, LOSS_REASONS, PARTY_KINDS, CLAIM_KINDS, CLAIM_STATUSES, PLATFORM_COLORS, REPORT_KINDS, SALE_CHANNELS, WEEKDAYS } from "./constants";
import { ATTENDANCE_STATUSES } from "./hr";
import { ASSIGNABLE_PERMISSIONS, ROLES } from "./permissions";

/** Request schemas: the web forms and the API validate with the same rules. */

const paise = z.number().int().nonnegative();
/** Quantities may be fractional (kg, tons), up to three decimals. */
const qty = z.number().positive().max(1_000_000).transform((n) => Math.round(n * 1000) / 1000);
const qty0 = z.number().nonnegative().max(1_000_000).transform((n) => Math.round(n * 1000) / 1000);
const id = z.string().min(1);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const monthKey = z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM");
const text = (max = 200) => z.string().trim().max(max);
const optionalText = (max = 500) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(128),
  /** Employees can only sign in from the shop, so their phone sends its location. */
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracyM: z.number().nonnegative() }).optional(),
});
export const changePasswordSchema = z.object({ current: z.string().min(1), next: z.string().min(8, "At least 8 characters").max(128) });

/* ── Catalogue ── */
export const productSchema = z.object({
  name: text(120).min(2),
  category: text(60).min(1, "Choose or type a category"),
  unit: text(20).default("pcs"),
  /** Retail price. Wholesale is separate; 0 means he does not sell it wholesale. */
  sellingPricePaise: paise.default(0),
  wholesalePricePaise: paise.default(0),
  /** GST rate charged on sales of this item (prices include it). 0 = none. */
  gstPct: z.number().min(0).max(100).default(0),
  /** The business this item belongs to. Items are never shared between businesses. */
  businessId: id,
  notes: optionalText(),
  /** Stock already on the shelf before using the app. */
  openingQty: qty0.default(0),
  openingUnitCostPaise: paise.default(0),
});
export const productUpdateSchema = productSchema.pick({ name: true, category: true, unit: true, sellingPricePaise: true, wholesalePricePaise: true, gstPct: true, notes: true }).partial();
export const categoryRenameSchema = z.object({ from: text(60).min(1), to: text(60).min(1) });

/* ── Buying trips ── */
export const tripItemSchema = z
  .object({
    productId: id.optional(),
    newProduct: z.object({ name: text(120).min(2), category: text(60).min(1), unit: text(20).default("pcs") }).optional(),
    qty,
    /** What he paid in total for all pieces of this line. */
    linePaise: paise,
    /** Only when the market price does NOT include GST: the percentage added on top. */
    gstPct: z.number().min(0).max(100).optional(),
    /** Selling price per piece he decided on (0 = leave unchanged). */
    unitPricePaise: paise.default(0),
  })
  .refine((i) => !!i.productId !== !!i.newProduct, { message: "Pick a product or create a new one" });

export const tripCostSchema = z.object({
  kind: text(30).min(1),
  label: optionalText(80),
  amountPaise: paise.refine((n) => n > 0, "Amount must be more than zero"),
  paidBy: optionalText(60),
});

export const tripSchema = z.object({
  date: dateKey,
  title: optionalText(80),
  place: optionalText(80),
  notes: optionalText(),
  basis: z.enum(["VALUE", "QTY"]).default("QTY"),
  /** Which business paid for this trip. */
  businessId: id,
  items: z.array(tripItemSchema).min(1, "Add at least one item"),
  costs: z.array(tripCostSchema).default([]),
});

/* ── Businesses and places ── */
export const businessSchema = z.object({ name: text(60).min(2), kind: z.enum(BUSINESS_KINDS), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#B45309") });
export const locationSchema = z.object({
  name: text(60).min(2),
  kind: z.enum(LOCATION_KINDS),
  businessId: id,
  /** Days a haat or stall is open, e.g. SUN and WED. */
  days: z.array(z.enum(WEEKDAYS)).default([]),
  active: z.boolean().default(true),
});

/* ── Selling, dues, losses ── */
export const saleSchema = z.object({
  businessId: id,
  locationId: id.nullish(),
  channel: z.enum(SALE_CHANNELS),
  date: dateKey,
  customerId: id.nullish(),
  /** One bill with items, or just the day's total when he does not list every sale. */
  items: z.array(z.object({ productId: id, qty, unitPricePaise: paise })).default([]),
  totalPaise: paise.optional(),
  /** Money received now. Anything less than the total becomes a due on the customer. */
  paidPaise: paise.optional(),
  note: optionalText(200),
}).refine((s) => s.items.length > 0 || (s.totalPaise ?? 0) > 0, { message: "Add items or enter the day's total" });
export const returnSchema = z.object({
  businessId: id,
  locationId: id.nullish(),
  productId: id,
  qty,
  date: dateKey,
  condition: z.enum(["GOOD", "DAMAGED"]),
  refundPaise: paise.default(0),
  note: optionalText(200),
});
export const lossSchema = z.object({
  businessId: id,
  locationId: id.nullish(),
  productId: id,
  qty,
  date: dateKey,
  reason: z.enum(LOSS_REASONS),
  note: optionalText(200),
});
export const transferSchema = z.object({ productId: id, qty, fromLocationId: id.nullable(), toLocationId: id, note: optionalText(200) }).refine((t) => t.fromLocationId !== t.toLocationId, { message: "Choose two different places" });
export const partySchema = z.object({ businessId: id, name: text(80).min(2), kind: z.enum(PARTY_KINDS), phone: optionalText(20), note: optionalText(200) });
export const entrySchema = z.object({
  partyId: id,
  kind: z.enum(ENTRY_KINDS),
  amountPaise: paise.refine((n) => n > 0, "Enter an amount"),
  date: dateKey,
  note: optionalText(200),
});

/* ── Processing, couriers, funds ── */
export const batchSchema = z.object({
  businessId: id,
  date: dateKey,
  name: text(80).min(2),
  /** Raw goods used up. */
  inputs: z.array(z.object({ productId: id, qty })).min(1, "Add the goods you used"),
  /** Finished goods made. */
  outputs: z.array(z.object({ productId: id, qty })).min(1, "Add what came out"),
  /** Colour, labour, packing material... */
  costs: z.array(z.object({ kind: text(40).min(1), label: optionalText(80), amountPaise: paise })).default([]),
  note: optionalText(200),
});
export const courierMoveSchema = z.object({
  businessId: id,
  date: dateKey,
  platformId: id.nullish(),
  courier: text(40).min(2),
  outgoing: z.number().int().nonnegative().default(0),
  customerReturn: z.number().int().nonnegative().default(0),
  rto: z.number().int().nonnegative().default(0),
  time: optionalText(10),
});
export const fundTransferSchema = z.object({ date: dateKey, fromBusinessId: id, toBusinessId: id, amountPaise: paise.refine((n) => n > 0, "Enter an amount"), note: optionalText(200) }).refine((t) => t.fromBusinessId !== t.toBusinessId, { message: "Choose two different businesses" });

/* ── Marketplace claims ── */
export const claimSchema = z.object({
  platformId: id,
  orderId: text(60).min(1, "Enter the order number"),
  productId: id.nullish(),
  date: dateKey,
  kind: z.enum(CLAIM_KINDS),
  status: z.enum(CLAIM_STATUSES).default("RAISED"),
  /** Why it was approved or rejected, as the platform said. */
  reason: optionalText(200),
  /** What he expected to get back, and what the platform actually paid. */
  expectedPaise: paise.default(0),
  receivedPaise: paise.default(0),
  note: optionalText(200),
});

/* ── Stock ── */
export const countSchema = z.object({
  counts: z.array(z.object({ productId: id, counted: qty0 })).min(1),
  note: optionalText(200),
});
export const priceUpdateSchema = z.object({ prices: z.array(z.object({ productId: id, sellingPricePaise: paise })).min(1) });

/* ── Platforms ── */
export const platformSchema = z.object({ businessId: id, name: text(40).min(2), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(PLATFORM_COLORS[0]) });
export const reportUploadSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  /** Optional: sales reports take their month from the order dates inside the file. */
  month: monthKey.optional(),
  /** field key → header name in the file. Saved on the platform after first use. */
  mapping: z.record(z.string(), z.string()).optional(),
  amountPaise: paise.optional(),
  note: optionalText(200),
});
export const aliasSchema = z.object({ alias: text(200).min(1), productId: id });

/* ── Money ── */
export const investmentSchema = z.object({
  date: dateKey,
  label: text(100).min(2),
  category: text(60).min(1),
  /** Which business this spending belongs to. */
  businessId: id,
  /** A fair or haat this spending was for (stall rent, transport...). */
  locationId: id.nullish(),
  amountPaise: paise.refine((n) => n > 0, "Amount must be more than zero"),
  note: optionalText(),
});

/* ── Team ── */
export const employeeSchema = z.object({
  name: text(80).min(2),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Enter a valid phone"),
  designation: text(60).min(2),
  joinDate: dateKey,
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  /** Monthly salary, paid in cash. Only the owner ever sees it. */
  salaryPaise: paise.default(0),
  /** Which business pays this salary, so it shows in that business's accounts. */
  businessId: id.nullish(),
});
export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative(),
  deviceId: z.string().min(6).max(100),
  /** JPEG data URL captured live from the front camera. */
  selfie: z.string().startsWith("data:image/jpeg;base64,").max(2_000_000, "Selfie too large"),
});
export const manualAttendanceSchema = z.object({
  employeeId: id,
  date: dateKey,
  status: z.enum(ATTENDANCE_STATUSES),
});

/* ── Settings & logins ── */
export const settingsSchema = z.object({
  name: text(100).min(2),
  address: optionalText(200),
  geofenceLat: z.number().min(-90).max(90),
  geofenceLng: z.number().min(-180).max(180),
  geofenceRadiusM: z.number().int().min(20).max(2000),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
  lateGraceMin: z.number().int().min(0).max(120),
  selfieRetentionDays: z.number().int().min(7).max(365),
  /** Paid leave days per year, per employee. */
  leaveCl: z.number().int().min(0).max(60),
  leaveSick: z.number().int().min(0).max(60),
  leaveEarned: z.number().int().min(0).max(60),
});
export const userCreateSchema = z.object({
  name: text(80).min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "At least 8 characters").max(128),
  role: z.enum(ROLES).default("STAFF"),
  employeeId: id.optional(),
  /** Which employee role (what they may see). Leave empty for a login that only checks in and out. */
  roleId: id.optional(),
});
export const roleSchema = z.object({
  name: text(40).min(2),
  permissions: z.array(z.enum(ASSIGNABLE_PERMISSIONS)).default([]),
});
export const materialSchema = z.object({
  businessId: id,
  name: text(80).min(2),
  qty: z.number().int().nonnegative(),
  /** At or below this count the item shows as "needs buying". */
  minQty: z.number().int().nonnegative().default(0),
  unit: text(20).default("pcs"),
});

export type RoleInput = z.infer<typeof roleSchema>;
export type MaterialInput = z.infer<typeof materialSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type TripInput = z.infer<typeof tripSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type InvestmentInput = z.infer<typeof investmentSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type BusinessInput = z.infer<typeof businessSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
