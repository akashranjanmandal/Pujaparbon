/** All money is stored as integer paise. These helpers are the only place we convert. */

const groupIndian = (n: string) => {
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3);
  return rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
};

export function formatINR(paise: number, opts: { decimals?: boolean } = {}): string {
  const { decimals = true } = opts;
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}₹${groupIndian(String(rupees))}${decimals ? `.${fraction}` : ""}`;
}

/** ₹1.5L, ₹2.3Cr — for KPI tiles. */
export function compactINR(paise: number): string {
  const rupees = paise / 100;
  const trim = (n: number) => String(Number(n.toFixed(1)));
  if (Math.abs(rupees) >= 1e7) return `₹${trim(rupees / 1e7)}Cr`;
  if (Math.abs(rupees) >= 1e5) return `₹${trim(rupees / 1e5)}L`;
  if (Math.abs(rupees) >= 1e3) return `₹${trim(rupees / 1e3)}K`;
  return `₹${Math.round(rupees)}`;
}

export function toPaise(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Not a money value: ${value}`);
  return Math.round(n * 100);
}

export const fromPaise = (paise: number) => paise / 100;
