import { istDateKey } from "./hr";

export type RangePreset = "today" | "week" | "month" | "lastMonth" | "last30" | "last90" | "year" | "custom";
export interface DateRange { from: string; to: string }

export const RANGE_LABELS: Record<Exclude<RangePreset, "custom">, string> = {
  today: "Today", week: "This week", month: "This month", lastMonth: "Last month", last30: "Last 30 days", last90: "Last 3 months", year: "This year",
};

const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);

export const shiftDays = (d: string, n: number) => {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return key(x);
};
const daysBetween = (a: string, b: string) => Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000) + 1;
const lastDayOfMonth = (y: number, m: number) => key(new Date(Date.UTC(y, m, 0)));

/** Presets are calendar ranges in India time. A week runs Monday to Sunday. */
export function resolveRange(preset: Exclude<RangePreset, "custom">, now: Date = new Date()): DateRange {
  const today = istDateKey(now);
  const [y, m] = today.split("-").map(Number);
  switch (preset) {
    case "today": return { from: today, to: today };
    case "week": {
      const dow = (toUtc(today).getUTCDay() + 6) % 7; // Monday = 0
      const from = shiftDays(today, -dow);
      return { from, to: shiftDays(from, 6) };
    }
    case "month": return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: lastDayOfMonth(y, m) };
    case "lastMonth": {
      const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
      return { from: `${py}-${String(pm).padStart(2, "0")}-01`, to: lastDayOfMonth(py, pm) };
    }
    case "last30": return { from: shiftDays(today, -29), to: today };
    case "last90": return { from: shiftDays(today, -89), to: today };
    case "year": return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/** The period of equal length immediately before. */
export function previousRange(r: DateRange): DateRange {
  const len = daysBetween(r.from, r.to);
  return { from: shiftDays(r.from, -len), to: shiftDays(r.from, -1) };
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
