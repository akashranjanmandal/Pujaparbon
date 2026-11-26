/**
 * Demo data for Pujo Parbon. Deterministic (seeded random); safe to re-run: it wipes and rebuilds the demo business.
 * Models a seller who buys lots at the market, sells on three platforms, and counts his stock every couple of days.
 */
import { eq } from "drizzle-orm";
import { allocateTrip, istDateKey, tripTotals, formatINR } from "@pp/shared";
import { db, libsql } from "./client";
import * as s from "./schema";
import { runMigrations } from "./migrate";
import { hashPassword } from "../lib/password";
import { newDoc, letterhead, footer, PDF } from "../lib/pdf";
import { env } from "../config/env";

/* ---------- deterministic random ---------- */
let seed = 20261119;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
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
const DAY = 86_400_000;
const NOW = new Date();
const dayKey = (offset: number) => istDateKey(new Date(NOW.getTime() - offset * DAY));
const at = (offset: number, hh: number, mm = 0) => new Date(`${dayKey(offset)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);
const rupees = (n: number) => Math.round(n * 100);
const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (p: string) => p + Array.from({ length: 6 }, () => CODE[int(0, CODE.length - 1)]).join("");

async function chunked(table: Parameters<typeof db.insert>[0], rows: unknown[], size = 40) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

/* ---------- catalogue: categories are whatever he typed ---------- */
const CATALOGUE = [
  { name: "Steel Water Bottle 1L", category: "Bottles & Flasks", cost: 82, price: 199, demand: 3.0 },
  { name: "Plastic Sipper 750ml", category: "Bottles & Flasks", cost: 26, price: 79, demand: 2.0 },
  { name: "Insulated Flask 500ml", category: "Bottles & Flasks", cost: 140, price: 349, demand: 1.2 },
  { name: "Lunch Box with 2 Containers", category: "Kitchen", cost: 42, price: 149, demand: 2.2 },
  { name: "Steel Spice Rack 7 Jar", category: "Kitchen", cost: 115, price: 299, demand: 0.8 },
  { name: "Silicone Spatula Set of 5", category: "Kitchen", cost: 55, price: 179, demand: 1.5 },
  { name: "Glass Storage Jar Set of 3", category: "Kitchen", cost: 135, price: 349, demand: 0.9 },
  { name: "Wooden Puzzle Set", category: "Toys", cost: 65, price: 199, demand: 1.3 },
  { name: "Pull-back Toy Car", category: "Toys", cost: 32, price: 99, demand: 1.6 },
  { name: "Soft Teddy 30cm", category: "Toys", cost: 78, price: 249, demand: 0.9 },
  { name: "Spiral Notebook A5 Pack of 5", category: "Stationery", cost: 58, price: 179, demand: 2.0 },
  { name: "Gel Pen Box of 20", category: "Stationery", cost: 38, price: 129, demand: 2.4 },
  { name: "School Backpack 25L", category: "Bags", cost: 210, price: 599, demand: 0.8 },
  { name: "Zip Pouch Organizer", category: "Bags", cost: 28, price: 99, demand: 1.6 },
];
const PLATFORMS = [
  { name: "Flipkart", color: "#2874F0", share: 40, fee: 0.13 },
  { name: "Amazon", color: "#FF9900", share: 35, fee: 0.15 },
  { name: "Meesho", color: "#9F2089", share: 25, fee: 0.07 },
];
const COLUMN_MAP = { orderId: "Order ID", date: "Order Date", product: "Product", sku: "SKU", qty: "Quantity", amount: "Sale Amount", fees: "Platform Fee", settled: "Settlement Amount", state: "State", status: "Status" };
// The same item is listed under a different title on a platform: he links it once in the app.
const MARKET_TITLE: Record<string, Record<string, string>> = { Meesho: { "Gel Pen Box of 20": "Gel Pens Pack of 20 Blue Ink Smooth Writing" } };
const STATES: [string, number][] = [["West Bengal", 22], ["Maharashtra", 12], ["Karnataka", 11], ["Delhi", 10], ["Tamil Nadu", 8], ["Uttar Pradesh", 8], ["Gujarat", 6], ["Telangana", 6], ["Bihar", 5], ["Odisha", 4], ["Assam", 3], ["Rajasthan", 3], ["Kerala", 2]];
const PLACES = ["Barabazar wholesale", "Posta bazaar", "Sealdah market", "Burrabazar"];
const TRIP_DAYS = [178, 164, 150, 136, 123, 109, 95, 81, 67, 53, 39, 25, 11, 4];

async function main() {
  await runMigrations();
  console.log(`[seed] target: ${env.db.mode}`);
  for (const t of [s.packagingMaterials, s.auditLogs, s.attendance, s.employees, s.productAliases, s.platformSales, s.platformReports, s.platforms, s.investments, s.tripCosts, s.tripItems, s.trips, s.stockMovements, s.products, s.refreshTokens, s.users, s.roles, s.tenants]) await db.delete(t);

  const tenantId = crypto.randomUUID();
  await db.insert(s.tenants).values({ id: tenantId, name: "Pujo Parbon", slug: "pujo-parbon", address: "Sarisha, South 24 Parganas, West Bengal", geofenceLat: 22.2701, geofenceLng: 88.2052, geofenceRadiusM: 150, shiftStart: "10:00", shiftEnd: "19:00", lateGraceMin: 10, selfieRetentionDays: 90 });

  /* team */
  const team = [["Rina Das", "Helper"], ["Sourav Mondal", "Packing"], ["Moumita Pal", "Packing"], ["Arup Sarkar", "Loader"]] as const;
  const emps = team.map(([name, designation], i) => ({ id: crypto.randomUUID(), tenantId, code: `E${String(i + 1).padStart(3, "0")}`, name, phone: `98${int(30000000, 99999999)}`, designation, salaryPaise: rupees([12000, 11000, 11000, 10000][i]), joinDate: dayKey(int(150, 700)), shiftStart: "10:00", avatarHue: (i * 83 + 12) % 360 }));
  await db.insert(s.employees).values(emps);
  const packingRole = crypto.randomUUID();
  await db.insert(s.roles).values({ id: packingRole, tenantId, name: "Packing team", permissions: JSON.stringify(["packaging.view", "packaging.manage"]) });
  await db.insert(s.packagingMaterials).values([["Small boxes", 140, 60], ["Large boxes", 22, 30], ["Packing tape rolls", 9, 6], ["Bubble wrap (metres)", 40, 50], ["Poly mailers", 220, 100]].map(([name, qty, minQty]) => ({ tenantId, name: String(name), qty: Number(qty), minQty: Number(minQty) })));
  const pw = await hashPassword("PujaParbon@2026");
  await db.insert(s.users).values([
    { tenantId, name: "Somnath Pal", email: "owner@pujaparbon.in", passwordHash: pw, role: "OWNER" as const },
    { tenantId, name: "Rina Das", email: "staff@pujaparbon.in", passwordHash: pw, role: "STAFF" as const, employeeId: emps[0].id },
    { tenantId, name: "Sourav Mondal", email: "sourav@pujaparbon.in", passwordHash: pw, role: "STAFF" as const, employeeId: emps[1].id, roleId: packingRole },
  ]);

  /* products + platforms */
  const prods = CATALOGUE.map((p) => ({ ...p, id: crypto.randomUUID(), code: code("P"), sell: rupees(p.price) }));
  await db.insert(s.products).values(prods.map((p) => ({ id: p.id, tenantId, code: p.code, name: p.name, category: p.category, unit: "pcs", sellingPricePaise: p.sell, createdAt: at(180, 12) })));
  const plats = PLATFORMS.map((p) => ({ ...p, id: crypto.randomUUID() }));
  await db.insert(s.platforms).values(plats.map((p) => ({ id: p.id, tenantId, name: p.name, color: p.color, columnMap: COLUMN_MAP, createdAt: at(180, 12) })));

  /* ---------- simulate 180 days ---------- */
  const ledger = new Map(prods.map((p) => [p.id, { qty: 0, value: 0 }]));
  const physical = new Map(prods.map((p) => [p.id, 0]));
  const moves: (typeof s.stockMovements.$inferInsert)[] = [];
  const tripRows: (typeof s.trips.$inferInsert)[] = [];
  const itemRows: (typeof s.tripItems.$inferInsert)[] = [];
  const costRows: (typeof s.tripCosts.$inferInsert)[] = [];
  const sales: (typeof s.platformSales.$inferInsert & { _platform: string; _month: string })[] = [];
  const unit = (id: string) => { const l = ledger.get(id)!; return l.qty > 0 ? l.value / l.qty : 0; };
  const lastCost = new Map<string, number>();
  const sellNow = new Map(prods.map((p) => [p.id, p.sell]));
  const reportIds = new Map<string, string>(); // platform|month → report id
  for (const p of plats) for (let m = 0; m <= 6; m++) { const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - m, 1)); reportIds.set(`${p.name}|${d.toISOString().slice(0, 7)}`, crypto.randomUUID()); }
  const lastCountDay = 3; // he last updated counts three days ago, so the app nudges him
  let orderN = 100000;

  for (let off = 180; off >= 0; off--) {
    const dk = dayKey(off);
    const month = dk.slice(0, 7);
    const m = Number(month.slice(5, 7));

    /* a trip to the market */
    if (TRIP_DAYS.includes(off)) {
      const place = pick(PLACES);
      const chosen = prods.filter(() => rnd() < 0.7 || off === 178);
      const lines = chosen.map((p) => {
        const qty = Math.max(20, Math.round((p.demand * 17 * (0.95 + rnd() * 0.5)) / 5) * 5);
        const unitPaise = Math.round(rupees(p.cost) * (0.93 + rnd() * 0.14));
        return { p, qty, linePaise: qty * unitPaise };
      });
      const costs = [
        { kind: "Travel", label: "Bus and auto", amountPaise: rupees(int(120, 260)), paidBy: "Somnath" },
        { kind: "Food", label: "Lunch and tea", amountPaise: rupees(int(110, 220)), paidBy: "Somnath" },
        { kind: "Food", label: "Helper's food", amountPaise: rupees(int(90, 180)), paidBy: "Rina" },
        { kind: "Transport", label: "Van to the shop", amountPaise: rupees(int(350, 800)), paidBy: "Somnath" },
        ...(rnd() < 0.55 ? [{ kind: "Toll", label: "Toll plaza", amountPaise: rupees(int(60, 140)), paidBy: "Van driver" }] : []),
        ...(rnd() < 0.5 ? [{ kind: "Labour", label: "Loading and unloading", amountPaise: rupees(int(200, 400)), paidBy: "Somnath" }] : []),
      ];
      const totals = tripTotals(lines.map((l) => ({ qty: l.qty, linePaise: l.linePaise })), costs);
      const split = allocateTrip(lines.map((l) => ({ qty: l.qty, linePaise: l.linePaise })), totals.costsPaise, "VALUE");
      const tid = crypto.randomUUID();
      tripRows.push({ id: tid, tenantId, code: code("L"), date: dk, title: `${place} trip`, place, notes: null, basis: "VALUE", itemsPaise: totals.itemsPaise, costsPaise: totals.costsPaise, totalPaise: totals.totalPaise, createdAt: at(off, 18) });
      costs.forEach((c) => costRows.push({ tripId: tid, ...c }));
      lines.forEach((l, i) => {
        const sp = split[i];
        // The price he lists at: roughly last time's price, never below cost.
        const unitPrice = Math.max(Math.ceil((sp.unitCostPaise + 100) / 100) * 100, Math.round((l.p.sell * (0.95 + rnd() * 0.1)) / 100) * 100);
        itemRows.push({ tripId: tid, productId: l.p.id, qty: l.qty, linePaise: l.linePaise, extraPaise: sp.extraPaise, landedPaise: sp.landedPaise, unitCostPaise: sp.unitCostPaise, unitPricePaise: unitPrice });
        moves.push({ tenantId, productId: l.p.id, qty: l.qty, valuePaise: sp.landedPaise, type: "BUY", refType: "trip", refId: tid, note: `Bought at ${place}`, createdAt: at(off, 18, 5) });
        const e = ledger.get(l.p.id)!; e.qty += l.qty; e.value += sp.landedPaise;
        physical.set(l.p.id, physical.get(l.p.id)! + l.qty);
        lastCost.set(l.p.id, sp.unitCostPaise);
        sellNow.set(l.p.id, unitPrice);
      });
    }

    /* the day's sales on each platform */
    const season = m === 10 ? 1.7 : m === 11 ? 1.35 : m === 9 ? 1.15 : 1;
    for (const pl of plats) {
      const n = Math.round(((pl.share / 100) * (12 + rnd() * 5) * season) * (off === 0 ? 0.5 : 1));
      for (let k = 0; k < n; k++) {
        const p = weighted(prods.map((x) => [x, x.demand] as [typeof prods[number], number]));
        const qty = rnd() < 0.78 ? 1 : rnd() < 0.7 ? 2 : 3;
        if ((physical.get(p.id) ?? 0) < qty) continue;
        const status = weighted([["DELIVERED", 90], ["RETURNED", 7], ["CANCELLED", 3]] as ["DELIVERED" | "RETURNED" | "CANCELLED", number][]);
        const priceEach = Math.round(((sellNow.get(p.id) ?? p.sell) * (0.94 + rnd() * 0.06)) / 100) * 100;
        const gross = priceEach * qty;
        const fees = status === "DELIVERED" ? Math.round(gross * (pl.fee + (rnd() - 0.5) * 0.02)) : 0;
        const title = MARKET_TITLE[pl.name]?.[p.name] ?? p.name;
        const matched = title === p.name;
        const cost = status === "DELIVERED" && matched ? Math.round(unit(p.id) * qty) : 0;
        if (status === "DELIVERED") physical.set(p.id, physical.get(p.id)! - qty);
        orderN++;
        sales.push({
          tenantId, platformId: pl.id, reportId: reportIds.get(`${pl.name}|${month}`)!, lineKey: `OD${orderN}#1`, orderId: `OD${orderN}`, orderDate: dk, productName: title, sku: p.code, productId: matched ? p.id : null, qty,
          grossPaise: gross, feesPaise: fees, netPaise: status === "DELIVERED" ? gross - fees : 0, state: weighted(STATES), status, costPaise: cost, _platform: pl.name, _month: month,
        });
      }
    }

    /* he updates his counts every other day (until a few days ago) */
    if (off >= lastCountDay && (off - lastCountDay) % 2 === 0 && off < 178) {
      for (const p of prods) {
        const l = ledger.get(p.id)!;
        const real = Math.max(0, physical.get(p.id)! - (rnd() < 0.08 ? 1 : 0)); // now and then one piece is found broken or missing
        physical.set(p.id, real);
        const diff = real - l.qty;
        if (diff === 0) { moves.push({ tenantId, productId: p.id, qty: 0, valuePaise: 0, type: "COUNT", note: "Counted, no change", createdAt: at(off, 20, 15) }); continue; }
        const value = real === 0 ? -l.value : Math.round(diff * (l.qty > 0 ? l.value / l.qty : lastCost.get(p.id) ?? 0));
        moves.push({ tenantId, productId: p.id, qty: diff, valuePaise: value, type: "COUNT", note: `Counted ${real} (was ${l.qty})`, createdAt: at(off, 20, 15) });
        l.qty += diff; l.value += value;
      }
    }
  }

  // Current selling prices
  for (const p of prods) await db.update(s.products).set({ sellingPricePaise: sellNow.get(p.id)! }).where(eq(s.products.id, p.id));
  await chunked(s.trips, tripRows); await chunked(s.tripItems, itemRows); await chunked(s.tripCosts, costRows); await chunked(s.stockMovements, moves, 60);

  /* reports: one monthly sales CSV per platform (the original file is kept, so it can be downloaded), plus the platform's invoice */
  const byKey = new Map<string, typeof sales>();
  for (const r of sales) { const k = `${r._platform}|${r._month}`; byKey.set(k, [...(byKey.get(k) ?? []), r]); }
  const reportRows: (typeof s.platformReports.$inferInsert)[] = [];
  const csvOf = (rows: typeof sales) => ["Order ID,Order Date,Product,SKU,Quantity,Sale Amount,Platform Fee,Settlement Amount,State,Status", ...rows.map((r) => [r.orderId, r.orderDate, `"${r.productName}"`, r.sku, r.qty, (r.grossPaise / 100).toFixed(2), ((r.feesPaise ?? 0) / 100).toFixed(2), (r.netPaise / 100).toFixed(2), r.state, r.status[0] + r.status.slice(1).toLowerCase()].join(","))].join("\n");
  const invoicePdf = async (platform: string, month: string, fees: number) => {
    const { doc, done } = newDoc();
    letterhead(doc, { name: platform, address: "Seller services invoice" }, "Commission invoice", month);
    doc.fillColor(PDF.ink).font("Helvetica").fontSize(11).text(`Seller: Pujo Parbon`, 40, 120).text(`Period: ${month}`, 40, 140).text(`Marketplace fees and commission: ${formatINR(fees)}`, 40, 170);
    footer(doc, `${platform} · sample invoice for the demo`);
    doc.end();
    return done;
  };
  for (const [k, id] of reportIds) {
    const [platform, month] = k.split("|");
    const rows = byKey.get(k) ?? [];
    if (!rows.length) continue;
    const pl = plats.find((p) => p.name === platform)!;
    const csv = Buffer.from(csvOf(rows));
    const isCurrent = month === dayKey(0).slice(0, 7);
    reportRows.push({ id, tenantId, platformId: pl.id, kind: "SALES", month, fileName: `${platform.toLowerCase()}-sales-${month}.csv`, mime: "text/csv", size: csv.length, data: csv, rowsTotal: rows.length, rowsImported: rows.length, rowsSkipped: 0, errors: [], createdAt: at(isCurrent ? 2 : 0, 11) });
    if (!isCurrent) {
      const fees = rows.reduce((a, r) => a + (r.feesPaise ?? 0), 0);
      const pdf = await invoicePdf(platform, month, fees);
      reportRows.push({ tenantId, platformId: pl.id, kind: "INVOICE", month, fileName: `${platform.toLowerCase()}-invoice-${month}.pdf`, mime: "application/pdf", size: pdf.length, data: pdf, amountPaise: fees, note: "Commission invoice", createdAt: at(0, 11) });
    }
  }
  for (let i = 0; i < reportRows.length; i += 6) await db.insert(s.platformReports).values(reportRows.slice(i, i + 6));
  await chunked(s.platformSales, sales.map(({ _platform: _p, _month: _m, ...r }) => r), 45);
  await db.insert(s.productAliases).values(plats.filter((p) => p.name === "Amazon").map((p) => ({ tenantId, platformId: p.id, alias: "steel water bottle 1l", productId: prods[0].id })));

  /* other investments */
  const inv: (typeof s.investments.$inferInsert)[] = [
    { tenantId, date: dayKey(175), label: "Weighing machine", category: "Equipment", amountPaise: rupees(2400) },
    { tenantId, date: dayKey(170), label: "Shelving rack for the godown", category: "Equipment", amountPaise: rupees(4200) },
    { tenantId, date: dayKey(120), label: "Packing table", category: "Equipment", amountPaise: rupees(3100) },
  ];
  for (let mo = 6; mo >= 0; mo--) {
    const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - mo, 1)).toISOString().slice(0, 7);
    if (d + "-05" > dayKey(0)) continue;
    inv.push({ tenantId, date: `${d}-05`, label: "Godown rent", category: "Rent", amountPaise: rupees(3500) }, { tenantId, date: `${d}-12`, label: "Packing tape and covers", category: "Packing", amountPaise: rupees(int(800, 1400)) }, { tenantId, date: `${d}-15`, label: "Mobile data and internet", category: "Utilities", amountPaise: rupees(299) });
  }
  await chunked(s.investments, inv.filter((x) => x.date <= dayKey(0)));

  /* attendance for the last two months */
  const att: (typeof s.attendance.$inferInsert)[] = [];
  const nowMin = (NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440;
  for (let off = 60; off >= 0; off--) {
    const dk = dayKey(off);
    if (new Date(`${dk}T12:00:00Z`).getUTCDay() === 0) continue;
    for (const [i, e] of emps.entries()) {
      if (off === 0) {
        if (nowMin < 9 * 60 + 40 || i === 3) continue;
        const late = i === 2;
        const inAt = new Date(`${dk}T${late ? "10:21" : `09:${int(42, 58)}`}:00+05:30`);
        if (inAt > NOW) continue;
        att.push({ tenantId, employeeId: e.id, date: dk, status: late ? "LATE" : "PRESENT", checkInAt: inAt, checkInDistanceM: int(4, 60), deviceId: `seed-${i}`, source: "GEOFENCE" });
        continue;
      }
      const r = rnd();
      if (r < 0.015) { att.push({ tenantId, employeeId: e.id, date: dk, status: r < 0.008 ? "CL" : "SICK", source: "MANUAL" }); continue; }
      if (r < 0.04) { att.push({ tenantId, employeeId: e.id, date: dk, status: "ABSENT", source: "MANUAL" }); continue; }
      const late = r > 0.88, half = r > 0.86 && r <= 0.88;
      att.push({ tenantId, employeeId: e.id, date: dk, status: half ? "HALF_DAY" : late ? "LATE" : "PRESENT", checkInAt: new Date(`${dk}T${late ? `10:${int(12, 40)}` : `09:${int(40, 59)}`}:00+05:30`), checkOutAt: new Date(`${dk}T${half ? "14" : int(18, 19)}:${String(int(0, 59)).padStart(2, "0")}:00+05:30`), checkInDistanceM: int(3, 90), checkOutDistanceM: int(3, 90), deviceId: `seed-${i}`, source: "GEOFENCE" });
    }
  }
  await chunked(s.attendance, att, 50);

  const stockValue = [...ledger.values()].reduce((a, l) => a + l.value, 0);
  console.log(`[seed] Pujo Parbon ready: ${prods.length} products, ${tripRows.length} buying trips, ${sales.length} platform sales, ${reportRows.length} uploaded files, ${att.length} attendance rows. Stock value ${formatINR(stockValue, { decimals: false })}.`);
  console.log("[seed] Logins (password PujaParbon@2026): owner@pujaparbon.in · staff@pujaparbon.in");
  libsql.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
