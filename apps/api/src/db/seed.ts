/**
 * Demo data for Puja Parbon. Deterministic (seeded random), safe to re-run: it wipes and rebuilds the demo tenant.
 * Festival dates below are illustrative for the demo and can be edited in the Holidays screen.
 */
import { CHANNELS, calcInvoice, computePayslip, istDateKey, workingDaysInMonth } from "@pp/shared";
import { db, libsql } from "./client";
import * as s from "./schema";
import { runMigrations } from "./migrate";
import { hashPassword } from "../lib/password";
import { env } from "../config/env";

/* ---------- deterministic random ---------- */
let seed = 20261117;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
const weighted = <T,>(items: [T, number][]) => {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[0][0];
};
const uuid = () => crypto.randomUUID();
const DAY = 86_400_000;
const NOW = new Date();
const ist = (dayOffset: number, hh: number, mm: number) => {
  const key = istDateKey(new Date(NOW.getTime() - dayOffset * DAY));
  return new Date(`${key}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);
};
const rupees = (n: number) => Math.round(n * 100);

async function chunked<T>(table: Parameters<typeof db.insert>[0], rows: T[], size = 80) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

/* ---------- catalogue ---------- */
type V = { code: string; size?: string; color?: string };
const CATALOGUE: { name: string; category: string; hsn: string; gst: number; emoji: string; mrp: number; price: number; cost: number; desc: string; popularity: number; variants: V[] }[] = [
  { name: "Laal Paar Garad Silk Saree", category: "Sarees", hsn: "5007", gst: 5, emoji: "🥻", mrp: 4999, price: 3499, cost: 1950, popularity: 9, desc: "Classic red-bordered white garad for Ashtami anjali.", variants: [{ code: "GARAD-RW", color: "Red-White" }, { code: "GARAD-MW", color: "Maroon-White" }] },
  { name: "Shantipur Tant Saree", category: "Sarees", hsn: "5208", gst: 5, emoji: "🥻", mrp: 1899, price: 1299, cost: 640, popularity: 10, desc: "Handwoven cotton tant from Shantipur weavers.", variants: [{ code: "TANT-RED", color: "Sindoor Red" }, { code: "TANT-MUS", color: "Mustard" }, { code: "TANT-TEAL", color: "Teal" }] },
  { name: "Bishnupur Baluchari Silk", category: "Sarees", hsn: "5007", gst: 5, emoji: "🥻", mrp: 8999, price: 6499, cost: 3800, popularity: 4, desc: "Mythological motifs woven into the pallu.", variants: [{ code: "BALU-PNK", color: "Rani Pink" }, { code: "BALU-BLU", color: "Peacock Blue" }] },
  { name: "Phulia Jamdani Saree", category: "Sarees", hsn: "5208", gst: 5, emoji: "🥻", mrp: 5999, price: 4299, cost: 2400, popularity: 5, desc: "Fine count jamdani with floral buti.", variants: [{ code: "JAM-WHT", color: "Off-White" }, { code: "JAM-GRN", color: "Bottle Green" }] },
  { name: "Kantha Stitch Dupatta", category: "Women's Wear", hsn: "6214", gst: 5, emoji: "🧣", mrp: 1699, price: 1199, cost: 600, popularity: 6, desc: "Hand-embroidered kantha on soft silk.", variants: [{ code: "KANTHA-YLW", color: "Marigold" }, { code: "KANTHA-BLK", color: "Black" }] },
  { name: "Men's Cotton Panjabi", category: "Men's Wear", hsn: "6205", gst: 5, emoji: "👘", mrp: 1299, price: 899, cost: 420, popularity: 9, desc: "Festive cotton panjabi with wooden buttons.", variants: [{ code: "PANJ-M", size: "M" }, { code: "PANJ-L", size: "L" }, { code: "PANJ-XL", size: "XL" }] },
  { name: "Silk Dhoti", category: "Men's Wear", hsn: "5007", gst: 5, emoji: "👘", mrp: 999, price: 699, cost: 330, popularity: 5, desc: "Ready-to-wear silk dhoti with gold border.", variants: [{ code: "DHOTI-STD", size: "Free" }] },
  { name: "Brass Pradip Set of 5", category: "Puja Essentials", hsn: "7418", gst: 12, emoji: "🪔", mrp: 799, price: 549, cost: 240, popularity: 8, desc: "Hand-polished brass diyas.", variants: [{ code: "PRADIP-5" }] },
  { name: "Natural Shankha (Conch)", category: "Puja Essentials", hsn: "9601", gst: 12, emoji: "🐚", mrp: 1199, price: 799, cost: 380, popularity: 6, desc: "Blowable conch, cleaned and polished.", variants: [{ code: "SHANKHA-M", size: "Medium" }, { code: "SHANKHA-L", size: "Large" }] },
  { name: "Brass Puja Thali Set", category: "Puja Essentials", hsn: "7418", gst: 12, emoji: "🪷", mrp: 1699, price: 1199, cost: 560, popularity: 7, desc: "Seven-piece thali with ghanta and kosha-kushi.", variants: [{ code: "THALI-7" }] },
  { name: "Clay Dhunuchi", category: "Puja Essentials", hsn: "6912", gst: 12, emoji: "🏺", mrp: 399, price: 249, cost: 90, popularity: 8, desc: "For the dhunuchi naach at aarti.", variants: [{ code: "DHUNUCHI-STD" }] },
  { name: "Sindoor Kouto", category: "Puja Essentials", hsn: "4420", gst: 12, emoji: "🔴", mrp: 499, price: 349, cost: 140, popularity: 6, desc: "Hand-painted wooden sindoor box.", variants: [{ code: "KOUTO-RED", color: "Red" }] },
  { name: "Terracotta Durga Murti", category: "Idols & Decor", hsn: "6913", gst: 12, emoji: "🙏", mrp: 2199, price: 1499, cost: 700, popularity: 5, desc: "Krishnanagar clay, hand-finished. 12 inch.", variants: [{ code: "MURTI-12" }] },
  { name: "Shola Pith Mukut", category: "Idols & Decor", hsn: "4602", gst: 12, emoji: "👑", mrp: 1299, price: 899, cost: 400, popularity: 4, desc: "Traditional shola crown from Bonkati artisans.", variants: [{ code: "MUKUT-STD" }] },
  { name: "Kash Phool Decor Bunch", category: "Idols & Decor", hsn: "0604", gst: 5, emoji: "🌾", mrp: 449, price: 299, cost: 110, popularity: 5, desc: "Dried kash grass — the sign that Pujo is near.", variants: [{ code: "KASH-12" }] },
  { name: "Alpana Stencil Kit", category: "Idols & Decor", hsn: "4823", gst: 18, emoji: "🎨", mrp: 299, price: 199, cost: 60, popularity: 6, desc: "Six reusable alpana stencils with rice-paste guide.", variants: [{ code: "ALPANA-6" }] },
];

const CHANNEL_WEIGHTS: [string, number][] = [["FLIPKART", 34], ["AMAZON", 26], ["MEESHO", 18], ["MYNTRA", 12], ["AJIO", 5], ["OWN_STORE", 5]];
const PREFIX: Record<string, string> = { FLIPKART: "FK", AMAZON: "AMZ", MYNTRA: "MYN", MEESHO: "MSH", AJIO: "AJ" };
const ORDER_ID: Record<string, () => string> = {
  FLIPKART: () => `OD${int(4e8, 9e8)}${int(1e8, 9e8)}`,
  AMAZON: () => `40${int(1, 9)}-${int(1e6, 9e6)}-${int(1e6, 9e6)}`,
  MYNTRA: () => `${int(1e9, 9e9)}`,
  MEESHO: () => `${int(1e11, 9e11)}_1`,
  AJIO: () => `FN${int(1e8, 9e8)}`,
  OWN_STORE: () => `PP-${int(10000, 99999)}`,
};

const FIRST = ["Ananya", "Debolina", "Sayan", "Rituparna", "Arindam", "Moumita", "Sudipta", "Priyanka", "Soumya", "Tanushree", "Abhishek", "Neha", "Rohit", "Sneha", "Kunal", "Ishita", "Aditya", "Pooja", "Rahul", "Shreya", "Vikram", "Anjali", "Arpita", "Subhankar"];
const LAST = ["Sen", "Chatterjee", "Banerjee", "Mukherjee", "Das", "Ghosh", "Bose", "Roy", "Sharma", "Gupta", "Iyer", "Patel", "Singh", "Mitra", "Dutta", "Saha", "Nair", "Reddy"];
const PLACES: [string, string, number][] = [
  ["Kolkata", "West Bengal", 30], ["Howrah", "West Bengal", 8], ["Siliguri", "West Bengal", 5], ["Durgapur", "West Bengal", 4],
  ["Bhubaneswar", "Odisha", 5], ["Guwahati", "Assam", 5], ["Patna", "Bihar", 4], ["Ranchi", "Jharkhand", 3], ["Agartala", "Tripura", 3],
  ["Bengaluru", "Karnataka", 9], ["Delhi", "Delhi", 8], ["Mumbai", "Maharashtra", 7], ["Pune", "Maharashtra", 3], ["Hyderabad", "Telangana", 4],
  ["Chennai", "Tamil Nadu", 3], ["Lucknow", "Uttar Pradesh", 2], ["Ahmedabad", "Gujarat", 2],
];

/** Festive demand curve: Mahalaya → Dashami peak, a second bump for Kali Puja / Diwali. */
function demand(dayOffset: number) {
  const d = new Date(NOW.getTime() - dayOffset * DAY);
  const m = d.getMonth() + 1, day = d.getDate();
  let k = 1;
  if (m === 9 && day >= 15) k = 1.8;
  if (m === 10 && day <= 21) k = 3.2;
  if (m === 10 && day > 21) k = 1.6;
  if (m === 11 && day <= 10) k = 2.1;
  const weekday = d.getDay();
  if (weekday === 0) k *= 1.25;
  return k;
}

async function wipe() {
  const order = [
    s.auditLogs, s.expenses, s.invoiceItems, s.invoices, s.payslips, s.holidays, s.leaves, s.attendance, s.tasks, s.returns, s.orderItems,
    s.orders, s.importBatches, s.customers, s.purchaseItems, s.purchases, s.suppliers, s.stockMovements, s.bins, s.channelListings,
    s.variants, s.products, s.refreshTokens, s.users, s.employees, s.channels, s.tenants,
  ];
  for (const t of order) await db.delete(t);
}

async function main() {
  await runMigrations();
  console.log(`[seed] target: ${env.db.mode}`);
  await wipe();

  /* tenant */
  const tenantId = uuid();
  await db.insert(s.tenants).values({
    id: tenantId, name: "Puja Parbon", slug: "puja-parbon", gstin: "19ABCDE1234F1Z5", address: "Sarisha, South 24 Parganas, West Bengal 743368",
    state: "West Bengal", geofenceLat: 22.2701, geofenceLng: 88.2052, geofenceRadiusM: 150, shiftStart: "10:00", shiftEnd: "19:00", lateGraceMin: 10, selfieRetentionDays: 90,
  });
  const chanIds: Record<string, string> = {};
  await db.insert(s.channels).values(CHANNELS.map((c) => {
    chanIds[c.code] = uuid();
    return { id: chanIds[c.code], tenantId, code: c.code, name: c.name, color: c.color };
  }));

  /* team */
  const team: [string, string, string, number][] = [
    ["Bikram Roy", "Warehouse Supervisor", "Operations", 28000], ["Rina Das", "Picker", "Warehouse", 14000], ["Sourav Mondal", "Packer", "Warehouse", 13500],
    ["Priya Ghosh", "Inventory Executive", "Warehouse", 17000], ["Arjun Sarkar", "Dispatch Executive", "Logistics", 16000], ["Moumita Pal", "Quality Checker", "Warehouse", 15000],
    ["Tapas Naskar", "Loader", "Logistics", 12500], ["Sumana Halder", "Packer", "Warehouse", 13500], ["Ananya Bose", "Accounts Assistant", "Accounts", 18000], ["Rahul Mistri", "Picker", "Warehouse", 14000],
  ];
  const emps = team.map(([name, designation, department, salary], i) => ({
    id: uuid(), tenantId, code: `PP-E${String(i + 1).padStart(3, "0")}`, name, phone: `98${int(30000000, 99999999)}`, designation, department,
    joinDate: istDateKey(new Date(NOW.getTime() - int(120, 900) * DAY)), monthlySalaryPaise: rupees(salary), shiftStart: "10:00", avatarHue: (i * 37 + 12) % 360,
  }));
  await db.insert(s.employees).values(emps);

  const pw = await hashPassword("PujaParbon@2026");
  await db.insert(s.users).values([
    { tenantId, name: "Somnath Pal", email: "owner@pujaparbon.in", passwordHash: pw, role: "OWNER" },
    { tenantId, name: "Bikram Roy", email: "manager@pujaparbon.in", passwordHash: pw, role: "MANAGER", employeeId: emps[0].id },
    { tenantId, name: "Rina Das", email: "staff@pujaparbon.in", passwordHash: pw, role: "STAFF", employeeId: emps[1].id },
    { tenantId, name: "Sourav Mondal", email: "sourav@pujaparbon.in", passwordHash: pw, role: "STAFF", employeeId: emps[2].id },
  ]);

  /* catalogue */
  const binRows = [
    ...["A-01", "A-02", "A-03", "A-04", "A-05", "A-06"].map((code) => ({ code, zone: "Sarees" })),
    ...["B-01", "B-02", "B-03"].map((code) => ({ code, zone: "Apparel" })),
    ...["C-01", "C-02", "C-03", "C-04", "C-05"].map((code) => ({ code, zone: "Puja Essentials" })),
    ...["D-01", "D-02", "D-03"].map((code) => ({ code, zone: "Idols & Decor" })),
  ].map((b) => ({ ...b, id: uuid(), tenantId }));
  await db.insert(s.bins).values(binRows);
  const binFor = (category: string) => pick(binRows.filter((b) => b.zone === (category === "Sarees" ? "Sarees" : category.includes("Wear") ? "Apparel" : category)));

  type VarRow = typeof s.variants.$inferInsert & { id: string; popularity: number; gst: number; hsn: string; productName: string; binId: string };
  const allVariants: VarRow[] = [];
  const listingRows: (typeof s.channelListings.$inferInsert)[] = [];
  for (const p of CATALOGUE) {
    const productId = uuid();
    await db.insert(s.products).values({ id: productId, tenantId, name: p.name, category: p.category, description: p.desc, hsnCode: p.hsn, gstRate: p.gst, emoji: p.emoji, createdAt: new Date(NOW.getTime() - 200 * DAY) });
    for (const v of p.variants) {
      const id = uuid();
      const sku = `PP-${v.code}`;
      allVariants.push({ id, tenantId, productId, sku, size: v.size ?? null, color: v.color ?? null, mrpPaise: rupees(p.mrp), pricePaise: rupees(p.price), costPaise: rupees(p.cost), reorderLevel: p.price > 3000 ? 3 : 8, popularity: p.popularity, gst: p.gst, hsn: p.hsn, productName: p.name, binId: binFor(p.category).id });
      for (const ch of ["FLIPKART", "AMAZON", "MEESHO", "MYNTRA", "AJIO"]) {
        if (ch === "MYNTRA" && !["Sarees", "Women's Wear", "Men's Wear"].includes(p.category)) continue;
        if (ch === "AJIO" && rnd() < 0.5) continue;
        listingRows.push({ tenantId, variantId: id, channelId: chanIds[ch], channelSku: `${PREFIX[ch]}-${v.code}`, listingId: ch === "FLIPKART" ? `SRE${int(1e9, 9e9)}` : ch === "AMAZON" ? `B0${int(1e7, 9e7)}X` : null });
      }
    }
  }
  await chunked(s.variants, allVariants.map(({ popularity: _p, gst: _g, hsn: _h, productName: _n, binId: _b, ...v }) => v));
  await chunked(s.channelListings, listingRows);

  /* suppliers */
  const supplierRows = [
    ["Shantipur Tant Weavers Co-op", "Haripada Basak", "Shantipur", "Sarees"], ["Bishnupur Baluchari House", "Gopal Dutta", "Bishnupur", "Sarees"],
    ["Phulia Jamdani Collective", "Nemai Pramanik", "Phulia", "Sarees"], ["Barabazar Brass Emporium", "Ramesh Agarwal", "Kolkata", "Puja Essentials"],
    ["Kumartuli Artisans Guild", "Kartik Pal", "Kolkata", "Idols & Decor"], ["Burrabazar Apparel Traders", "Imran Sheikh", "Kolkata", "Wear"],
  ].map(([name, contactName, city, focus]) => ({ id: uuid(), tenantId, name, contactName, city, phone: `9${int(100000000, 999999999)}`, gstin: `19${String.fromCharCode(65 + int(0, 25))}BCDE${int(1000, 9999)}F1Z${int(1, 9)}`, focus }));
  await db.insert(s.suppliers).values(supplierRows.map(({ focus: _f, ...r }) => ({ ...r, createdAt: new Date(NOW.getTime() - 220 * DAY) })));
  const supplierFor = (cat: string) => supplierRows.find((x) => cat.includes(x.focus) || x.focus.includes(cat)) ?? supplierRows[3];

  /* ---------- simulate 180 days ---------- */
  const onHand = new Map<string, number>();
  const moves: (typeof s.stockMovements.$inferInsert)[] = [];
  const purchaseRows: (typeof s.purchases.$inferInsert)[] = [];
  const purchaseItemRows: (typeof s.purchaseItems.$inferInsert)[] = [];
  const orderRows: (typeof s.orders.$inferInsert)[] = [];
  const itemRows: (typeof s.orderItems.$inferInsert)[] = [];
  const returnRows: (typeof s.returns.$inferInsert)[] = [];
  let poCounter = 0;

  const purchase = (dayOffset: number, vars: VarRow[], qtyFn: (v: VarRow) => number) => {
    const bySupplier = new Map<string, VarRow[]>();
    for (const v of vars) {
      const sup = supplierFor(CATALOGUE.find((p) => p.name === v.productName)!.category);
      bySupplier.set(sup.id, [...(bySupplier.get(sup.id) ?? []), v]);
    }
    for (const [supplierId, list] of bySupplier) {
      const id = uuid();
      const at = ist(dayOffset, 11, int(0, 59));
      const fy = at.getMonth() >= 3 ? `${at.getFullYear() % 100}-${(at.getFullYear() % 100) + 1}` : `${(at.getFullYear() % 100) - 1}-${at.getFullYear() % 100}`;
      let total = 0;
      for (const v of list) {
        const qty = qtyFn(v);
        total += qty * v.costPaise!;
        purchaseItemRows.push({ purchaseId: id, variantId: v.id, qty, costPaise: v.costPaise!, binId: v.binId });
        moves.push({ tenantId, variantId: v.id, binId: v.binId, qty, type: "PURCHASE", reason: `Purchase PP/PO/${fy}/${String(poCounter + 1).padStart(4, "0")}`, refType: "purchase", refId: id, createdAt: at });
        onHand.set(v.id, (onHand.get(v.id) ?? 0) + qty);
      }
      poCounter++;
      purchaseRows.push({ id, tenantId, supplierId, number: `PP/PO/${fy}/${String(poCounter).padStart(4, "0")}`, invoiceNo: `INV-${int(1000, 9999)}`, date: istDateKey(at), totalPaise: total, createdAt: at });
    }
  };

  purchase(180, allVariants, (v) => v.popularity * 6 + int(5, 15));

  for (let dayOffset = 179; dayOffset >= 0; dayOffset--) {
    // Restock anything low, the way a manager would, about twice a month.
    if (dayOffset % 15 === 7 || dayOffset === 40) {
      const low = allVariants.filter((v) => (onHand.get(v.id) ?? 0) < v.popularity * 4 && !(dayOffset < 10 && v.sku === "PP-BALU-BLU"));
      if (low.length) purchase(dayOffset, low, (v) => v.popularity * int(5, 9) * (dayOffset > 40 && dayOffset < 75 ? 2 : 1));
    }
    const count = Math.round((int(3, 7) + rnd() * 3) * demand(dayOffset) * (dayOffset === 0 ? 1.4 : 1));
    for (let n = 0; n < count; n++) {
      const channel = weighted(CHANNEL_WEIGHTS as [string, number][]);
      const nowHour = Math.floor((((NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440) / 60));
      const hour = dayOffset === 0 ? int(0, Math.max(0, nowHour - 1)) : weighted([[9, 2], [11, 4], [13, 5], [15, 4], [18, 5], [20, 7], [21, 8], [22, 6], [23, 3], [7, 1]] as [number, number][]);
      const orderedAt = ist(dayOffset, hour, int(0, 59));
      if (orderedAt > NOW) continue;
      const lines = rnd() < 0.85 ? 1 : 2;
      const chosen: VarRow[] = [];
      for (let l = 0; l < lines; l++) {
        const v = weighted(allVariants.filter((x) => !(channel === "MYNTRA" && !listingRows.some((r) => r.variantId === x.id && r.channelId === chanIds.MYNTRA))).map((x) => [x, x.popularity] as [VarRow, number]));
        if (!chosen.includes(v)) chosen.push(v);
      }
      const id = uuid();
      const [city, state] = weighted(PLACES.map(([c, st, w]) => [[c, st], w] as [[string, string], number]));
      // Status by age
      let status: "NEW" | "PICKED" | "PACKED" | "DISPATCHED" | "DELIVERED" | "CANCELLED" | "RETURNED";
      if (dayOffset === 0) status = weighted([["NEW", 6], ["PICKED", 2], ["PACKED", 2]]);
      else if (dayOffset === 1) status = weighted([["NEW", 1], ["PACKED", 3], ["DISPATCHED", 6]]);
      else if (dayOffset <= 4) status = weighted([["DISPATCHED", 7], ["DELIVERED", 3]]);
      else status = weighted([["DELIVERED", 90], ["CANCELLED", 4], ["RETURNED", 6]]);

      const qtyOf = () => (rnd() < 0.9 ? 1 : 2);
      const items = chosen.map((v) => ({ v, qty: qtyOf(), price: Math.round(v.pricePaise! * (channel === "MEESHO" ? 0.92 : rnd() < 0.2 ? 0.95 : 1)) }));
      const ships = ["DISPATCHED", "DELIVERED", "RETURNED"].includes(status);
      if (ships && items.some((i) => (onHand.get(i.v.id) ?? 0) < i.qty)) continue; // stock-out: the order never happened
      const total = items.reduce((a, i) => a + i.qty * i.price, 0);
      const feeRate = { FLIPKART: 0.19, AMAZON: 0.21, MYNTRA: 0.26, MEESHO: 0.12, AJIO: 0.24, OWN_STORE: 0.02 }[channel] ?? 0.2;
      const fees = Math.round(total * feeRate);
      const dispatchedAt = ships ? new Date(orderedAt.getTime() + int(4, 26) * 3600_000) : null;
      const settled = (status === "DELIVERED" && dayOffset > 9) ? (rnd() < 0.06 ? total - fees - rupees(int(40, 260)) : total - fees) : null;

      orderRows.push({
        id, tenantId, channelId: chanIds[channel], channelOrderId: ORDER_ID[channel](), customerName: `${pick(FIRST)} ${pick(LAST)}`, city, state, status, orderedAt,
        dispatchBy: new Date(orderedAt.getTime() + (channel === "AMAZON" ? 1 : 2) * DAY), dispatchedAt: dispatchedAt && dispatchedAt < NOW ? dispatchedAt : ships ? NOW : null,
        awb: ships ? `${pick(["EK", "DL", "XB", "SF"])}${int(1e9, 9e9)}` : null, totalPaise: total, feesPaise: settled != null || ships ? fees : 0,
        settledPaise: settled, settledAt: settled != null ? new Date(orderedAt.getTime() + int(7, 12) * DAY) : null, createdAt: orderedAt,
      });
      for (const i of items) {
        itemRows.push({ orderId: id, variantId: i.v.id, channelSku: channel === "OWN_STORE" ? i.v.sku : `${PREFIX[channel]}-${i.v.sku.slice(3)}`, qty: i.qty, pricePaise: i.price });
        if (ships) {
          moves.push({ tenantId, variantId: i.v.id, qty: -i.qty, type: "SALE", reason: `Dispatched order`, refType: "order", refId: id, createdAt: dispatchedAt! < NOW ? dispatchedAt! : NOW });
          onHand.set(i.v.id, (onHand.get(i.v.id) ?? 0) - i.qty);
        }
      }
      if (status === "RETURNED") {
        const i = items[0];
        const good = rnd() < 0.7;
        const rid = uuid();
        const at = new Date(orderedAt.getTime() + int(5, 12) * DAY);
        returnRows.push({ id: rid, tenantId, orderId: id, variantId: i.v.id, qty: i.qty, type: rnd() < 0.35 ? "RTO" : "CUSTOMER", condition: good ? "GOOD" : "DAMAGED", status: good ? "RESTOCKED" : "WRITTEN_OFF", reason: pick(["Size/fit issue", "Colour different from photo", "Damaged in transit", "Customer not available", "Changed mind"]), createdAt: at < NOW ? at : NOW });
        if (good) {
          moves.push({ tenantId, variantId: i.v.id, binId: i.v.binId, qty: i.qty, type: "RETURN", reason: "Customer return", refType: "return", refId: rid, createdAt: at < NOW ? at : NOW });
          onHand.set(i.v.id, (onHand.get(i.v.id) ?? 0) + i.qty);
        }
      }
    }
  }

  // A few incoming marketplace SKUs nobody has mapped yet — the alert shows the manager what to fix.
  const unmappedOrder = uuid();
  orderRows.push({ id: unmappedOrder, tenantId, channelId: chanIds.MEESHO, channelOrderId: ORDER_ID.MEESHO(), customerName: "Debolina Saha", city: "Kolkata", state: "West Bengal", status: "NEW", orderedAt: ist(0, 9, 12), dispatchBy: new Date(NOW.getTime() + DAY), totalPaise: rupees(1099), createdAt: ist(0, 9, 12) });
  itemRows.push({ orderId: unmappedOrder, variantId: null, channelSku: "MSH-TANT-ORANGE", qty: 1, pricePaise: rupees(1099) });
  // Two overdue orders to show dispatch alerts.
  for (const o of orderRows.filter((x) => x.status === "NEW").slice(0, 2)) o.dispatchBy = new Date(NOW.getTime() - 3 * 3600_000);

  // Stock count corrections
  for (const v of allVariants.slice(0, 4)) {
    const q = -Math.min(1, onHand.get(v.id) ?? 0);
    if (q) {
      moves.push({ tenantId, variantId: v.id, binId: v.binId, qty: q, type: "ADJUSTMENT", reason: "Cycle count: 1 piece found damaged", createdAt: ist(int(3, 20), 17, 30) });
      onHand.set(v.id, (onHand.get(v.id) ?? 0) + q);
    }
  }

  await chunked(s.purchases, purchaseRows);
  await chunked(s.purchaseItems, purchaseItemRows);
  await chunked(s.orders, orderRows, 50);
  await chunked(s.orderItems, itemRows);
  await chunked(s.returns, returnRows);
  await chunked(s.stockMovements, moves);
  await db.insert(s.importBatches).values(
    ["FLIPKART", "AMAZON", "MEESHO", "MYNTRA"].map((c, i) => ({
      tenantId, channelId: chanIds[c], kind: "ORDERS" as const, fileName: `${c.toLowerCase()}_orders_${istDateKey(ist(i, 9, 0))}.${c === "AMAZON" ? "txt.csv" : "xlsx"}`,
      rowsTotal: int(18, 60), rowsImported: int(15, 50), rowsSkipped: int(0, 4), errors: [], createdAt: ist(i, 9, 30 + i),
    })),
  );

  /* ---------- people: attendance, leave, tasks, payroll ---------- */
  const holidayRows = [
    ["2026-08-15", "Independence Day"], ["2026-10-10", "Mahalaya"], ["2026-10-18", "Maha Saptami"], ["2026-10-19", "Maha Ashtami"],
    ["2026-10-20", "Maha Navami"], ["2026-10-21", "Vijaya Dashami"], ["2026-10-25", "Lakshmi Puja"], ["2026-11-08", "Kali Puja"], ["2026-11-10", "Bhai Phonta"],
    ["2026-12-25", "Christmas"], ["2027-01-23", "Netaji Jayanti"], ["2027-02-11", "Saraswati Puja"],
  ].map(([date, name]) => ({ tenantId, date, name }));
  await db.insert(s.holidays).values(holidayRows);
  const holidaySet = new Set(holidayRows.map((h) => h.date));

  const leaveRows: (typeof s.leaves.$inferInsert)[] = [];
  const leaveDays = new Set<string>();
  const addLeave = (e: (typeof emps)[number], fromOff: number, len: number, type: "CASUAL" | "SICK" | "EARNED", status: "APPROVED" | "PENDING", reason: string) => {
    const from = istDateKey(new Date(NOW.getTime() - fromOff * DAY));
    const to = istDateKey(new Date(NOW.getTime() - (fromOff - len + 1) * DAY));
    leaveRows.push({ tenantId, employeeId: e.id, type, from, to, days: len, reason, status, createdAt: new Date(NOW.getTime() - (fromOff + 3) * DAY) });
    if (status === "APPROVED") for (let d = 0; d < len; d++) leaveDays.add(`${e.id}|${istDateKey(new Date(NOW.getTime() - (fromOff - d) * DAY))}`);
  };
  addLeave(emps[3], 34, 2, "SICK", "APPROVED", "Viral fever");
  addLeave(emps[6], 22, 3, "CASUAL", "APPROVED", "Going to the village for Lakshmi Puja");
  addLeave(emps[8], 12, 1, "CASUAL", "APPROVED", "Bank work");
  addLeave(emps[5], 1, 1, "SICK", "APPROVED", "Doctor appointment");
  addLeave(emps[2], -3, 2, "CASUAL", "PENDING", "Cousin's wedding in Bardhaman");
  addLeave(emps[9], -6, 1, "EARNED", "PENDING", "Personal work");
  addLeave(emps[7], -10, 3, "CASUAL", "PENDING", "Family trip to Digha");
  await db.insert(s.leaves).values(leaveRows);

  const attRows: (typeof s.attendance.$inferInsert)[] = [];
  const nowIstMin = (NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440;
  for (let off = 75; off >= 0; off--) {
    const date = istDateKey(new Date(NOW.getTime() - off * DAY));
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (dow === 0 || holidaySet.has(date)) continue;
    for (const [i, e] of emps.entries()) {
      if (leaveDays.has(`${e.id}|${date}`)) {
        attRows.push({ tenantId, employeeId: e.id, date, status: "LEAVE", source: "MANUAL" });
        continue;
      }
      if (off === 0) {
        // Today: most people are in, a couple are late, one has not arrived.
        if (nowIstMin < 9 * 60 + 40 || i === 9) continue;
        const late = i === 4 || i === 7;
        const inAt = new Date(`${date}T${late ? "10:2" + int(1, 8) : "09:" + int(42, 58)}:00+05:30`);
        if (inAt > NOW) continue;
        attRows.push({ tenantId, employeeId: e.id, date, status: late ? "LATE" : "PRESENT", checkInAt: inAt, checkInDistanceM: int(4, 60), deviceId: `seed-device-${i}`, source: "GEOFENCE" });
        continue;
      }
      const r = rnd();
      if (r < 0.03) {
        attRows.push({ tenantId, employeeId: e.id, date, status: "ABSENT", source: "MANUAL" });
        continue;
      }
      const late = r > 0.88;
      const half = r > 0.865 && r <= 0.88;
      const inAt = new Date(`${date}T${late ? `10:${int(12, 45)}` : `09:${int(40, 59)}`}:00+05:30`);
      const outAt = new Date(`${date}T${half ? "14" : int(18, 19)}:${String(int(0, 59)).padStart(2, "0")}:00+05:30`);
      attRows.push({ tenantId, employeeId: e.id, date, status: half ? "HALF_DAY" : late ? "LATE" : "PRESENT", checkInAt: inAt, checkOutAt: outAt, checkInDistanceM: int(3, 90), checkOutDistanceM: int(3, 90), deviceId: `seed-device-${i}`, source: "GEOFENCE" });
    }
  }
  await chunked(s.attendance, attRows);

  const taskTitles: [string, "LOW" | "MEDIUM" | "HIGH"][] = [
    ["Pick & pack today's Flipkart orders", "HIGH"], ["Cycle count bin A-03 (tant sarees)", "MEDIUM"], ["Receive Shantipur weavers consignment", "HIGH"],
    ["Print barcode labels for new Kantha stock", "MEDIUM"], ["Arrange RTO parcels for quality check", "MEDIUM"], ["Restock dhunuchi shelf C-04", "LOW"],
    ["Pack Meesho bulk order for Guwahati", "HIGH"], ["Clean and relabel zone D", "LOW"], ["Hand over manifest to Ekart pickup", "HIGH"],
    ["Photograph new Baluchari for listings", "MEDIUM"], ["Check damaged returns for repair", "LOW"], ["Update rack signage", "LOW"],
  ];
  await db.insert(s.tasks).values(taskTitles.map(([title, priority], i) => {
    const status = i < 4 ? "DONE" : i < 7 ? "IN_PROGRESS" : "TODO";
    return { tenantId, employeeId: emps[(i % 9) + 1].id, title, priority, status: status as "DONE", dueDate: istDateKey(new Date(NOW.getTime() + (i - 3) * DAY)), completedAt: status === "DONE" ? new Date(NOW.getTime() - int(1, 30) * 3600_000) : null, createdAt: new Date(NOW.getTime() - int(1, 4) * DAY) };
  }));

  // Payroll for the last two complete months; the older one is paid.
  const cur = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), 1));
  for (const back of [2, 1]) {
    const month = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
    const hols = holidayRows.filter((h) => h.date.startsWith(month)).map((h) => h.date);
    const wd = workingDaysInMonth(month, hols);
    await db.insert(s.payslips).values(emps.map((e) => {
      const mine = attRows.filter((a) => a.employeeId === e.id && a.date.startsWith(month));
      const present = mine.filter((a) => a.status === "PRESENT" || a.status === "LATE").length + mine.filter((a) => a.status === "HALF_DAY").length * 0.5;
      const leave = mine.filter((a) => a.status === "LEAVE").length;
      const late = mine.filter((a) => a.status === "LATE").length;
      const advance = e.code === "PP-E007" ? rupees(2000) : 0;
      const p = computePayslip({ monthlySalaryPaise: e.monthlySalaryPaise, workingDays: wd, presentDays: present || wd - 2, paidLeaveDays: leave, lateCount: late, advancePaise: advance });
      return { tenantId, employeeId: e.id, month, workingDays: wd, presentDays: present || wd - 2, paidLeaveDays: leave, lateCount: late, payableDays: p.payableDays, basePaise: e.monthlySalaryPaise, grossPaise: p.grossPaise, advancePaise: advance, netPaise: p.netPaise, status: back === 2 ? "PAID" as const : "DRAFT" as const };
    }));
  }

  /* ---------- offline invoices and expenses ---------- */
  const invRows: (typeof s.invoices.$inferInsert)[] = [];
  const invItemRows: (typeof s.invoiceItems.$inferInsert)[] = [];
  const buyers: [string, string | null, string][] = [["Mitra Bastralaya", "19AAKFM4521K1ZQ", "West Bengal"], ["Sarbojanin Durgotsab Committee, Behala", null, "West Bengal"], ["Odisha Handloom Mart", "21AABCO7712L1Z3", "Odisha"], ["Walk-in customer", null, "West Bengal"], ["Guwahati Puja Bhandar", "18AAGPG1203M1Z8", "Assam"]];
  let invN = 0;
  for (let off = 70; off >= 1; off -= int(2, 5)) {
    const [customerName, gstin, pos] = pick(buyers);
    const vs = [pick(allVariants), pick(allVariants)].filter((v, i, a) => a.indexOf(v) === i);
    const lines = vs.map((v) => ({ v, qty: int(1, customerName.includes("Committee") ? 12 : 3) }));
    if (lines.some((l) => (onHand.get(l.v.id) ?? 0) < l.qty)) continue;
    const totals = calcInvoice(lines.map((l) => ({ ratePaise: l.v.pricePaise!, qty: l.qty, gstRate: l.v.gst, inclusive: true })), { sellerState: "West Bengal", placeOfSupply: pos });
    const id = uuid();
    const at = ist(off, int(11, 18), int(0, 59));
    invN++;
    invRows.push({ id, tenantId, number: `PP/INV/${at.getMonth() >= 3 ? `${at.getFullYear() % 100}-${(at.getFullYear() % 100) + 1}` : `${(at.getFullYear() % 100) - 1}-${at.getFullYear() % 100}`}/${String(invN).padStart(4, "0")}`, date: istDateKey(at), channelId: chanIds.OFFLINE, customerName, customerGstin: gstin, placeOfSupply: pos, subtotalPaise: totals.subtotalPaise, cgstPaise: totals.cgstPaise, sgstPaise: totals.sgstPaise, igstPaise: totals.igstPaise, totalPaise: totals.totalPaise, createdAt: at });
    lines.forEach((l, i) => {
      invItemRows.push({ invoiceId: id, variantId: l.v.id, description: l.v.productName + (l.v.color ? ` — ${l.v.color}` : l.v.size ? ` — ${l.v.size}` : ""), hsn: l.v.hsn, qty: l.qty, ratePaise: l.v.pricePaise!, gstRate: l.v.gst, taxablePaise: totals.lines[i].taxablePaise, taxPaise: totals.lines[i].taxPaise });
      onHand.set(l.v.id, (onHand.get(l.v.id) ?? 0) - l.qty);
    });
    await db.insert(s.stockMovements).values(lines.map((l) => ({ tenantId, variantId: l.v.id, qty: -l.qty, type: "SALE" as const, reason: `Invoice ${invRows.at(-1)!.number}`, refType: "invoice", refId: id, createdAt: at })));
  }
  await chunked(s.invoices, invRows);
  await chunked(s.invoiceItems, invItemRows);

  // Make the low-stock widget interesting (runs after invoices so the ledger never dips below zero).
  const baluBlu = allVariants.find((v) => v.sku === "PP-BALU-BLU")!;
  const left = onHand.get(baluBlu.id) ?? 0;
  if (left > 2) {
    await db.insert(s.stockMovements).values({ tenantId, variantId: baluBlu.id, binId: baluBlu.binId, qty: -(left - 2), type: "OUTWARD", reason: "Sent to Kolkata exhibition stall", createdAt: ist(1, 12, 0) });
    onHand.set(baluBlu.id, 2);
  }

  const expRows: (typeof s.expenses.$inferInsert)[] = [];
  for (let back = 5; back >= 0; back--) {
    const m = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
    const festive = m.endsWith("-09") || m.endsWith("-10");
    expRows.push(
      { tenantId, date: `${m}-01`, category: "Rent", amountPaise: rupees(25000), note: "Warehouse rent, Sarisha" },
      { tenantId, date: `${m}-08`, category: "Electricity", amountPaise: rupees(int(3200, 4800)), note: "WBSEDCL bill" },
      { tenantId, date: `${m}-12`, category: "Packaging", amountPaise: rupees(festive ? int(14000, 19000) : int(5000, 8000)), note: "Boxes, tape, poly mailers" },
      { tenantId, date: `${m}-18`, category: "Transport", amountPaise: rupees(festive ? int(9000, 13000) : int(3500, 6000)), note: "Supplier pickups" },
    );
    if (festive) expRows.push({ tenantId, date: `${m}-05`, category: "Marketing", amountPaise: rupees(int(8000, 15000)), note: "Marketplace ads for Pujo sale" });
  }
  await db.insert(s.expenses).values(expRows.filter((e) => e.date <= istDateKey()));

  const [owner] = await db.select().from(s.users).limit(1);
  await db.insert(s.auditLogs).values([
    { tenantId, userId: owner.id, action: "orders.import", entity: "import_batch", meta: { channel: "FLIPKART", imported: 38 }, createdAt: ist(0, 9, 31) },
    { tenantId, userId: owner.id, action: "purchase.create", entity: "purchase", meta: { totalPaise: rupees(48600) }, createdAt: ist(0, 11, 5) },
    { tenantId, userId: owner.id, action: "order.dispatched", entity: "order", createdAt: ist(0, 12, 40) },
    { tenantId, userId: owner.id, action: "return.create", entity: "return", meta: { condition: "GOOD" }, createdAt: ist(1, 16, 10) },
    { tenantId, userId: owner.id, action: "payroll.run", entity: "payroll", createdAt: ist(2, 18, 0) },
  ]);

  console.log(`[seed] Puja Parbon ready: ${allVariants.length} SKUs, ${orderRows.length} orders, ${returnRows.length} returns, ${purchaseRows.length} purchases, ${attRows.length} attendance rows, ${invRows.length} invoices.`);
  console.log("[seed] Logins (password PujaParbon@2026): owner@pujaparbon.in · manager@pujaparbon.in · staff@pujaparbon.in");
  libsql.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
