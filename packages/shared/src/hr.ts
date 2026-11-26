const IST_OFFSET_MIN = 330;

const toIst = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000);

/** YYYY-MM-DD in Asia/Kolkata. Attendance rows are keyed by this. */
export const istDateKey = (d: Date = new Date()) => toIst(d).toISOString().slice(0, 10);

/** Minutes since IST midnight. */
export const istMinutes = (d: Date) => {
  const t = toIst(d);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};

const hhmm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** Presence plus the kinds of leave the owner can mark: casual, sick, event (shop event) and earned. */
export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "CL", "SICK", "EVENT", "EARNED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const LIMITED_LEAVES = ["CL", "SICK", "EARNED"] as const;
export type LimitedLeave = (typeof LIMITED_LEAVES)[number];

export function attendanceStatus(checkIn: Date, shiftStart: string, graceMin: number): "PRESENT" | "LATE" {
  return istMinutes(checkIn) > hhmm(shiftStart) + graceMin ? "LATE" : "PRESENT";
}

/** Working days = all days in the month except Sundays and listed holidays. */
export function workingDaysInMonth(month: string, holidays: string[]): number {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const holidaySet = new Set(holidays);
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(Date.UTC(y, m - 1, d));
    const key = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 0 && !holidaySet.has(key)) count++;
  }
  return count;
}

export interface PayInput {
  salaryPaise: number;
  workingDays: number;
  /** Days marked this month, by status. */
  counts: Partial<Record<AttendanceStatus, number>>;
  /** Yearly paid-leave allowance, and how much of it was used before this month. */
  allowance: Record<LimitedLeave, number>;
  usedBefore: Record<LimitedLeave, number>;
}

/**
 * Month-end pay. Present, late and event days are paid, a half day is half paid, and CL / sick / earned leave is
 * paid until the yearly allowance runs out. Absent days, days not marked, and leave beyond the allowance are unpaid.
 * Late arrivals are not penalised. Shortcut: Sundays are not holidays-aware, add a holiday list if the owner needs it.
 */
export function computePay(i: PayInput) {
  const c = (k: AttendanceStatus) => i.counts[k] ?? 0;
  let paidLeave = 0;
  let unpaidLeave = 0;
  for (const k of LIMITED_LEAVES) {
    const left = Math.max(0, i.allowance[k] - i.usedBefore[k]);
    paidLeave += Math.min(c(k), left);
    unpaidLeave += Math.max(0, c(k) - left);
  }
  const paidDays = Math.min(i.workingDays, c("PRESENT") + c("LATE") + c("EVENT") + c("HALF_DAY") / 2 + paidLeave);
  const payablePaise = i.workingDays > 0 ? Math.round((i.salaryPaise * paidDays) / i.workingDays) : 0;
  return { paidDays, unpaidLeave, payablePaise };
}
