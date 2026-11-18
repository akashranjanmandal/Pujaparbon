export const CHANNELS = [
  { code: "FLIPKART", name: "Flipkart", color: "#2874F0", listingLabel: "FSN" },
  { code: "AMAZON", name: "Amazon", color: "#FF9900", listingLabel: "ASIN" },
  { code: "MYNTRA", name: "Myntra", color: "#FF3F6C", listingLabel: "Style ID" },
  { code: "MEESHO", name: "Meesho", color: "#9F2089", listingLabel: "Catalog ID" },
  { code: "AJIO", name: "Ajio", color: "#2C4152", listingLabel: "Product code" },
  { code: "OFFLINE", name: "Offline / Shop", color: "#C8102E", listingLabel: "—" },
  { code: "OWN_STORE", name: "Pujo Parbon Store", color: "#E8B04B", listingLabel: "—" },
] as const;
export type ChannelCode = (typeof CHANNELS)[number]["code"];
export const CHANNEL_CODES = CHANNELS.map((c) => c.code) as [ChannelCode, ...ChannelCode[]];
/** Channels whose orders arrive as Seller Hub / Seller Central report files. */
export const IMPORTABLE_CHANNELS: ChannelCode[] = ["FLIPKART", "AMAZON", "MYNTRA", "MEESHO", "AJIO"];

export const ORDER_STATUSES = ["NEW", "PICKED", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED", "RETURNED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
/** Allowed forward moves on the dispatch board. */
export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["PICKED", "CANCELLED"],
  PICKED: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export const MOVEMENT_TYPES = ["PURCHASE", "INWARD", "SALE", "OUTWARD", "RETURN", "ADJUSTMENT", "TRANSFER"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const RETURN_TYPES = ["CUSTOMER", "RTO"] as const;
export const RETURN_CONDITIONS = ["GOOD", "DAMAGED"] as const;
export const RETURN_STATUSES = ["RECEIVED", "RESTOCKED", "WRITTEN_OFF"] as const;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID"] as const;
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const EXPENSE_CATEGORIES = ["Rent", "Wages", "Packaging", "Transport", "Electricity", "Marketing", "Other"] as const;

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;
