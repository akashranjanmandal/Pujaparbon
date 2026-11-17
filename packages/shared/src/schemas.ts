import { z } from "zod";
import {
  CHANNEL_CODES, EXPENSE_CATEGORIES, GST_RATES, LEAVE_TYPES, ORDER_STATUSES, RETURN_CONDITIONS, RETURN_TYPES,
  TASK_PRIORITIES, TASK_STATUSES,
} from "./constants";
import { ROLES } from "./permissions";

/** Shared request schemas: the web forms and the API validate with the same rules. */

const paise = z.number().int().nonnegative();
const id = z.string().min(1);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalText = z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined));

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(128),
  deviceId: z.string().max(100).optional(),
});

export const variantSchema = z.object({
  id: id.optional(),
  sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9-_]+$/, "Letters, numbers, - and _ only"),
  size: optionalText,
  color: optionalText,
  mrpPaise: paise,
  pricePaise: paise,
  costPaise: paise,
  reorderLevel: z.number().int().nonnegative().default(5),
  listings: z
    .array(z.object({ channel: z.enum(CHANNEL_CODES), channelSku: z.string().trim().min(1), listingId: optionalText }))
    .default([]),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  description: optionalText,
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, "HSN is 4–8 digits"),
  gstRate: z.number().refine((n) => (GST_RATES as readonly number[]).includes(n), "Invalid GST rate"),
  emoji: z.string().max(8).optional(),
  variants: z.array(variantSchema).min(1),
});

export const stockMoveSchema = z.object({
  variantId: id,
  binId: id.optional(),
  type: z.enum(["INWARD", "OUTWARD", "ADJUSTMENT"]),
  qty: z.number().int().refine((n) => n !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(3).max(200),
});

export const binSchema = z.object({
  code: z.string().trim().min(2).max(20),
  zone: z.string().trim().min(1).max(40),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: optionalText,
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Enter a valid phone").optional().or(z.literal("").transform(() => undefined)),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  gstin: z.string().trim().regex(/^[0-9A-Z]{15}$/, "GSTIN is 15 characters").optional().or(z.literal("").transform(() => undefined)),
  city: optionalText,
});

export const purchaseSchema = z.object({
  supplierId: id,
  invoiceNo: z.string().trim().min(1).max(40),
  date: dateKey,
  notes: optionalText,
  items: z.array(z.object({ variantId: id, qty: z.number().int().positive(), costPaise: paise, binId: id.optional() })).min(1),
});

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  awb: optionalText,
});

export const bulkOrderStatusSchema = z.object({
  orderIds: z.array(id).min(1).max(200),
  status: z.enum(ORDER_STATUSES),
});

export const manualOrderSchema = z.object({
  channel: z.enum(CHANNEL_CODES),
  customerName: z.string().trim().min(2),
  city: optionalText,
  state: z.string().trim().min(2),
  items: z.array(z.object({ variantId: id, qty: z.number().int().positive(), pricePaise: paise })).min(1),
});

export const returnSchema = z.object({
  orderId: id,
  variantId: id,
  qty: z.number().int().positive(),
  type: z.enum(RETURN_TYPES),
  condition: z.enum(RETURN_CONDITIONS),
  reason: z.string().trim().min(2).max(200),
  binId: id.optional(),
});

export const employeeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, "Enter a valid phone"),
  designation: z.string().trim().min(2).max(60),
  department: z.string().trim().min(2).max(60),
  joinDate: dateKey,
  monthlySalaryPaise: paise,
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
});

export const taskSchema = z.object({
  employeeId: id,
  title: z.string().trim().min(3).max(120),
  description: optionalText,
  dueDate: dateKey,
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
});
export const taskStatusSchema = z.object({ status: z.enum(TASK_STATUSES), note: optionalText });

export const checkInSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative(),
  deviceId: z.string().min(6).max(100),
  /** JPEG data URL captured live from the front camera. */
  selfie: z.string().startsWith("data:image/jpeg;base64,").max(2_000_000, "Selfie too large"),
});

export const leaveSchema = z.object({
  type: z.enum(LEAVE_TYPES),
  from: dateKey,
  to: dateKey,
  reason: z.string().trim().min(3).max(300),
}).refine((l) => l.from <= l.to, { message: "End date is before start date", path: ["to"] });
export const leaveDecisionSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export const payrollRunSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  advances: z.record(z.string(), paise).default({}),
});

export const invoiceSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerGstin: z.string().trim().regex(/^[0-9A-Z]{15}$/).optional().or(z.literal("").transform(() => undefined)),
  placeOfSupply: z.string().trim().min(2),
  channel: z.enum(CHANNEL_CODES).default("OFFLINE"),
  pricesInclusive: z.boolean().default(true),
  deductStock: z.boolean().default(true),
  items: z
    .array(z.object({
      variantId: id.optional(),
      description: z.string().trim().min(2),
      hsn: z.string().trim().min(4),
      qty: z.number().int().positive(),
      ratePaise: paise,
      gstRate: z.number(),
    }))
    .min(1),
});

export const expenseSchema = z.object({
  date: dateKey,
  category: z.enum(EXPENSE_CATEGORIES),
  amountPaise: paise.refine((n) => n > 0, "Amount must be positive"),
  note: optionalText,
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2),
  gstin: z.string().trim().optional(),
  address: z.string().trim().optional(),
  state: z.string().trim().min(2),
  geofenceLat: z.number().min(-90).max(90),
  geofenceLng: z.number().min(-180).max(180),
  geofenceRadiusM: z.number().int().min(20).max(2000),
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/),
  shiftEnd: z.string().regex(/^\d{2}:\d{2}$/),
  lateGraceMin: z.number().int().min(0).max(120),
  selfieRetentionDays: z.number().int().min(7).max(365),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "At least 8 characters").max(128),
  role: z.enum(ROLES),
  employeeId: id.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type StockMoveInput = z.infer<typeof stockMoveSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
