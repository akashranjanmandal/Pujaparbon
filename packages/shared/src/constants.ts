/** Trip cost types offered as quick buttons. The owner can also type any label of his own. */
export const COST_KINDS = ["Travel", "Food", "Toll", "Transport", "Labour", "Other"] as const;

export const PLATFORM_COLORS = ["#2874F0", "#FF9900", "#9F2089", "#FF3F6C", "#0E7C66", "#6B4EFF", "#D2643E", "#2E688C"] as const;
export const SUGGESTED_PLATFORMS = [
  { name: "Flipkart", color: "#2874F0" }, { name: "Amazon", color: "#FF9900" }, { name: "Meesho", color: "#9F2089" },
  { name: "Myntra", color: "#FF3F6C" }, { name: "Ajio", color: "#2C4152" }, { name: "JioMart", color: "#0E7C66" },
] as const;

export const SALE_STATUSES = ["DELIVERED", "RETURNED", "CANCELLED"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
export const MOVEMENT_TYPES = ["OPENING", "BUY", "COUNT"] as const;
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
