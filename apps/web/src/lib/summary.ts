export interface Summary {
  range: { from: string; to: string };
  totals: { tripsItemsPaise: number; tripsCostsPaise: number; otherPaise: number; grossPaise: number; feesPaise: number; netPaise: number; cogsPaise: number; orders: number; units: number; returnsPaise: number; returnOrders: number; cancelledOrders: number; moneyOutPaise: number; profitPaise: number; cashPaise: number };
  compare: { profitPct: number; netPct: number; moneyOutPct: number; days: number };
  moneyOut: { itemsPaise: number; tripCosts: { kind: string; amountPaise: number }[]; other: { category: string; amountPaise: number }[] };
  platforms: { id: string; name: string; color: string; grossPaise: number; feesPaise: number; netPaise: number; cogsPaise: number; profitPaise: number; orders: number; units: number; feePct: number }[];
  products: { best: { name: string; category: string | null; units: number; netPaise: number; profitPaise: number; marginPct: number }[]; worst: { name: string; category: string | null; units: number; netPaise: number; profitPaise: number; marginPct: number }[] };
  categories: { category: string; netPaise: number; profitPaise: number; units: number }[];
  states: { state: string; netPaise: number; orders: number }[];
  trend: { month: string; moneyOutPaise: number; netPaise: number; profitPaise: number }[];
  stock: { valuePaise: number; units: number; lastCountAt: number | null; lastBuyDate: string | null };
}

export const monthShort = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });

export interface Product { id: string; code: string; name: string; category: string; unit: string; sellingPricePaise: number; notes: string | null; onHand: number; valuePaise: number; avgCostPaise: number; marginPct: number; lastCountAt: number | null }
