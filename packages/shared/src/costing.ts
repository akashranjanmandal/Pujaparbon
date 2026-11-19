/**
 * Buying-trip costing. The owner buys stock in a lot at the market and also pays for the trip
 * (travel, food for himself and helpers, toll, transport...). Those costs belong to the goods:
 * they are spread over the items so every piece gets its real "landed" cost.
 * All money is integer paise.
 */

export type AllocationBasis = "VALUE" | "QTY";

export interface TripLine { qty: number; linePaise: number }
export interface TripLineResult { extraPaise: number; landedPaise: number; unitCostPaise: number }

/** Largest-remainder split: the shares always add up to exactly `extraPaise`. */
export function allocateTrip(lines: TripLine[], extraPaise: number, basis: AllocationBasis = "VALUE"): TripLineResult[] {
  let weights = lines.map((l) => (basis === "VALUE" ? l.linePaise : l.qty));
  let total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    weights = lines.map((l) => l.qty);
    total = weights.reduce((a, b) => a + b, 0);
  }
  const raw = weights.map((w) => (total > 0 ? (extraPaise * w) / total : 0));
  const base = raw.map(Math.floor);
  let remainder = extraPaise - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    base[i] += 1;
    remainder -= 1;
  }
  return lines.map((l, i) => {
    const landedPaise = l.linePaise + base[i];
    return { extraPaise: base[i], landedPaise, unitCostPaise: l.qty > 0 ? Math.round(landedPaise / l.qty) : 0 };
  });
}

export function tripTotals(lines: TripLine[], costs: { amountPaise: number }[]) {
  const itemsPaise = lines.reduce((s, l) => s + l.linePaise, 0);
  const costsPaise = costs.reduce((s, c) => s + c.amountPaise, 0);
  return { itemsPaise, costsPaise, totalPaise: itemsPaise + costsPaise, units: lines.reduce((s, l) => s + l.qty, 0) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Percentage a price sits above (+) or below (−) cost, to one decimal. */
export const pctOver = (costPaise: number, pricePaise: number) => (costPaise > 0 ? round1(((pricePaise - costPaise) / costPaise) * 100) : 0);

/** "Add ₹X (or take off ₹X) per piece" → price and the percentage that represents. */
export function priceFromAdjustment(unitCostPaise: number, adjustPaise: number) {
  const pricePaise = Math.max(0, unitCostPaise + adjustPaise);
  return { pricePaise, pct: pctOver(unitCostPaise, pricePaise) };
}

export function adjustmentFromPrice(unitCostPaise: number, pricePaise: number) {
  return { adjustPaise: pricePaise - unitCostPaise, pct: pctOver(unitCostPaise, pricePaise) };
}

export function priceFromPct(unitCostPaise: number, pct: number) {
  const pricePaise = Math.max(0, Math.round(unitCostPaise * (1 + pct / 100)));
  return { pricePaise, adjustPaise: unitCostPaise > 0 ? pricePaise - unitCostPaise : 0 };
}
