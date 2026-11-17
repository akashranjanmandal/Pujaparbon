export { formatINR, compactINR, toPaise, fromPaise } from "@pp/shared";

const IST = "Asia/Kolkata";
export const fmtDate = (d: string | number | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(d).toLocaleDateString("en-IN", { timeZone: IST, ...opts });
export const fmtDateTime = (d: string | number | Date) =>
  new Date(d).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const fmtTime = (d: string | number | Date) => new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
export const fmtNum = (n: number) => n.toLocaleString("en-IN");

export function timeAgo(d: string | number | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

export const istHour = () => Number(new Date().toLocaleString("en-IN", { timeZone: IST, hour: "numeric", hour12: false }));

/** Bengali greeting by Kolkata time of day. */
export function greeting(hour = istHour()) {
  if (hour >= 4 && hour < 11) return { bn: "শুভ সকাল", en: "Good morning" };
  if (hour >= 11 && hour < 16) return { bn: "শুভ দুপুর", en: "Good afternoon" };
  if (hour >= 16 && hour < 20) return { bn: "শুভ সন্ধ্যা", en: "Good evening" };
  return { bn: "শুভ রাত্রি", en: "Good night" };
}

export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });
export const monthKey = () => todayKey().slice(0, 7);
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|_|\s)(\w)/g, (_, a, b) => (a ? " " : "") + b.toUpperCase());
