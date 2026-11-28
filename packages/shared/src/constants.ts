/** Trip cost types offered as quick buttons. The owner can also type any label of his own. */
export const COST_KINDS = ["Travel", "Food", "Toll", "Transport", "Labour", "Other"] as const;

export const PLATFORM_COLORS = ["#2874F0", "#FF9900", "#9F2089", "#FF3F6C", "#0E7C66", "#6B4EFF", "#D2643E", "#2E688C"] as const;
export const SUGGESTED_PLATFORMS = [
  { name: "Flipkart", color: "#2874F0" }, { name: "Amazon", color: "#FF9900" }, { name: "Meesho", color: "#9F2089" },
  { name: "Myntra", color: "#FF3F6C" }, { name: "Ajio", color: "#2C4152" }, { name: "JioMart", color: "#0E7C66" },
] as const;

export const SALE_STATUSES = ["DELIVERED", "RETURNED", "RTO", "IN_TRANSIT", "CANCELLED"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
export const MOVEMENT_TYPES = ["OPENING", "BUY", "COUNT", "SALE", "RETURN", "LOSS", "TRANSFER", "PROCESS"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const REPORT_KINDS = ["SALES", "INVOICE"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Fields we look for in a platform's sales report. */
export const SALES_FIELDS = [
  { key: "orderId", label: "Order ID", required: false },
  { key: "date", label: "Order date", required: false },
  { key: "product", label: "Product name", required: false },
  { key: "sku", label: "SKU / product code", required: false },
  { key: "qty", label: "Quantity", required: false },
  { key: "amount", label: "Sale amount", required: true },
  { key: "fees", label: "Platform fee / commission", required: false },
  { key: "settled", label: "Amount received (settlement)", required: false },
  { key: "state", label: "Customer state", required: false },
  { key: "status", label: "Order status", required: false },
] as const;
export type SalesFieldKey = (typeof SALES_FIELDS)[number]["key"];

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

/** The family's businesses. Each has its own books; stock and the GST number are shared. */
export const BUSINESS_KINDS = ["CLAY", "FISH", "MELA", "PAINT", "ONLINE"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];
export const DEFAULT_BUSINESSES: { kind: BusinessKind; name: string; color: string }[] = [
  { kind: "CLAY", name: "Clay & puja shop", color: "#B45309" },
  { kind: "FISH", name: "Dried fish", color: "#0E7490" },
  { kind: "MELA", name: "Mela & fair stalls", color: "#7C3AED" },
  { kind: "PAINT", name: "Painting & wholesale", color: "#BE123C" },
  { kind: "ONLINE", name: "Online selling", color: "#15803D" },
];
/** Where goods are kept or sold. A haat or mela is a place too, so stock and sales can be tracked per place. */
export const LOCATION_KINDS = ["SHOP", "HAAT", "MELA", "WAREHOUSE", "ONLINE"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];
export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export const SALE_CHANNELS = ["SHOP", "HAAT", "MELA", "WHOLESALE"] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];
export const PARTY_KINDS = ["CUSTOMER", "SUPPLIER"] as const;
export const ENTRY_KINDS = ["BILL", "PAYMENT", "ADVANCE"] as const;
export const LOSS_REASONS = ["DAMAGED_RETURN", "WASTE", "SPOILAGE", "OTHER"] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const CLAIM_STATUSES = ["RAISED", "APPROVED", "REJECTED"] as const;
export const CLAIM_KINDS = ["DAMAGED", "WRONG_ITEM", "MISSING", "OTHER"] as const;
