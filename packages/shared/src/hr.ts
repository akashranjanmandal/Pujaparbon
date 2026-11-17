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

export type AttendanceStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE";

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

export interface PayslipInput {
  monthlySalaryPaise: number;
  workingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  lateCount: number;
  advancePaise: number;
}

/** Rule: every 3 late marks deduct half a day. Advances are recovered from net pay. */
export function computePayslip(i: PayslipInput) {
  const lateDeductionDays = Math.floor(i.lateCount / 3) * 0.5;
  const payableDays = Math.max(0, Math.min(i.workingDays, i.presentDays + i.paidLeaveDays) - lateDeductionDays);
  const perDay = i.workingDays > 0 ? i.monthlySalaryPaise / i.workingDays : 0;
  const grossPaise = Math.round(perDay * payableDays);
  const netPaise = Math.max(0, grossPaise - i.advancePaise);
  return { lateDeductionDays, payableDays, perDayPaise: Math.round(perDay), grossPaise, netPaise };
}
