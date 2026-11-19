import { toPaise } from "@pp/shared";

/** Parse what he typed ("1,200", "12.5", "₹40") into paise. Blank or unreadable is zero, never an error while typing. */
export const paise = (v: string | number | undefined | null): number => {
  if (v === undefined || v === null || v === "") return 0;
  try {
    return toPaise(v);
  } catch {
    return 0;
  }
};
/** Paise back to an editable rupee string. */
export const rupeeStr = (p: number) => (p ? String(Math.round(p) / 100) : "");
export const signed = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
