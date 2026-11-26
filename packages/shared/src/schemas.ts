import { z } from "zod";
import { PLATFORM_COLORS, REPORT_KINDS } from "./constants";
import { ATTENDANCE_STATUSES } from "./hr";
import { ASSIGNABLE_PERMISSIONS, ROLES } from "./permissions";

/** Request schemas: the web forms and the API validate with the same rules. */

const paise = z.number().int().nonnegative();
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
  sellingPricePaise: paise.default(0),
  notes: optionalText(),
  /** Stock already on the shelf before using the app. */
  openingQty: z.number().int().nonnegative().default(0),
  openingUnitCostPaise: paise.default(0),
});
export const productUpdateSchema = productSchema.pick({ name: true, category: true, unit: true, sellingPricePaise: true, notes: true }).partial();
export const categoryRenameSchema = z.object({ from: text(60).min(1), to: text(60).min(1) });

/* ── Buying trips ── */
export const tripItemSchema = z
  .object({
    productId: id.optional(),
    newProduct: z.object({ name: text(120).min(2), category: text(60).min(1), unit: text(20).default("pcs") }).optional(),
    qty: z.number().int().positive("Quantity must be at least 1"),
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
  items: z.array(tripItemSchema).min(1, "Add at least one item"),
  costs: z.array(tripCostSchema).default([]),
});

/* ── Stock ── */
export const countSchema = z.object({
  counts: z.array(z.object({ productId: id, counted: z.number().int().nonnegative() })).min(1),
  note: optionalText(200),
});
export const priceUpdateSchema = z.object({ prices: z.array(z.object({ productId: id, sellingPricePaise: paise })).min(1) });

/* ── Platforms ── */
export const platformSchema = z.object({ name: text(40).min(2), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default(PLATFORM_COLORS[0]) });
export const reportUploadSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  month: monthKey,
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
