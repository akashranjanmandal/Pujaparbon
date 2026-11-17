const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const upto99 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const upto999 = (n: number) =>
  n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${upto99(n % 100)}` : ""}` : upto99(n);

/** Indian system: crore, lakh, thousand. 123456 -> "One Lakh Twenty Three Thousand Four Hundred Fifty Six". */
export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${upto99(lakh)} Lakh`);
  if (thousand) parts.push(`${upto99(thousand)} Thousand`);
  if (rest) parts.push(upto999(rest));
  return parts.join(" ");
}

export function rupeesInWords(paise: number) {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${numberToWords(r)}${p ? ` and ${upto99(p)} Paise` : ""} Only`;
}
