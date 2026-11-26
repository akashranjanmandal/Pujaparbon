"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { COST_KINDS, adjustmentFromPrice, allocateTrip, formatINR, pctOver, priceFromPct, tripTotals, type AllocationBasis } from "@pp/shared";
import { ProductField, type CatalogItem, type PickedProduct } from "@/components/ProductField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Card, Field, Input, Segmented } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactINR, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { paise, rupeeStr } from "@/lib/money";

type Mode = "adjust" | "pct" | "price";
interface Line { id: number; product: PickedProduct | null; qty: string; paid: string; gst: boolean; gstPct: string; mode: Mode; value: string }
interface Cost { id: number; kind: string; label: string; amount: string; paidBy: string }
interface Saved { id: string; code: string; totalPaise: number; items: { productId: string; name: string }[]; expectedProfitPaise: number }

let seq = 1;
const newLine = (): Line => ({ id: seq++, product: null, qty: "", paid: "", gst: false, gstPct: "18", mode: "pct", value: "" });
const newCost = (kind = "Travel"): Cost => ({ id: seq++, kind, label: "", amount: "", paidBy: "" });

export default function NewBuyPage() {
  const router = useRouter();
  /** Trip costs are shared equally per piece. */
  const basis: AllocationBasis = "QTY";
  const { data: cat } = useQuery({ queryKey: ["products", ""], queryFn: () => api.get<{ items: CatalogItem[]; categories: { name: string }[] }>("/products") });
  const [date, setDate] = useState(todayKey());
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [costs, setCosts] = useState<Cost[]>([newCost("Travel"), newCost("Food")]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [bulkPct, setBulkPct] = useState("");

  /* ── the live calculation: everything below is derived from what he has typed ── */
  const calc = useMemo(() => {
    const filled = lines.map((l) => {
      const rawPaise = paise(l.paid);
      const gstPct = l.gst ? Math.max(0, Number(l.gstPct) || 0) : 0;
      return { l, qty: Math.max(0, Math.floor(Number(l.qty) || 0)), rawPaise, gstPct, linePaise: Math.round(rawPaise * (1 + gstPct / 100)) };
    });
    const usable = filled.filter((f) => f.qty > 0);
    const costRows = costs.map((c) => ({ amountPaise: paise(c.amount) })).filter((c) => c.amountPaise > 0);
    const totals = tripTotals(usable.map((f) => ({ qty: f.qty, linePaise: f.linePaise })), costRows);
    const split = allocateTrip(usable.map((f) => ({ qty: f.qty, linePaise: f.linePaise })), totals.costsPaise, basis);
    const rows = filled.map((f) => {
      const idx = usable.indexOf(f);
      const s = idx >= 0 ? split[idx] : null;
      const unit = s?.unitCostPaise ?? 0;
      const marketUnit = f.qty > 0 ? Math.round(f.linePaise / f.qty) : 0;
      const price =
        f.l.mode === "price" ? paise(f.l.value)
        : f.l.value.trim() === "" ? 0
        : f.l.mode === "adjust" ? Math.max(0, unit + paise(f.l.value))
        : priceFromPct(unit, Number(f.l.value) || 0).pricePaise;
      const back = price > 0 ? adjustmentFromPrice(unit, price) : { adjustPaise: 0, pct: 0 };
      return { ...f, unit, marketUnit, extra: s?.extraPaise ?? 0, landed: s?.landedPaise ?? 0, price, adjustPaise: back.adjustPaise, pct: back.pct };
    });
    const priced = rows.filter((r) => r.qty > 0 && r.price > 0);
    const expectedSales = priced.reduce((s, r) => s + r.qty * r.price, 0);
    const allPriced = rows.filter((r) => r.qty > 0).length === priced.length && priced.length > 0;
    return { rows, totals, expectedSales, allPriced, pricedCost: priced.reduce((s, r) => s + r.landed, 0), unpriced: rows.filter((r) => r.qty > 0 && r.price === 0).length };
  }, [lines, costs]);

  const setLine = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const setCost = (id: number, patch: Partial<Cost>) => setCosts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const applyToAll = () => setLines((ls) => ls.map((l) => ({ ...l, mode: "pct", value: bulkPct })));

  const problems: string[] = [];
  lines.forEach((l, i) => {
    if (!l.product) return problems.push(`Item ${i + 1}: choose or type the item`);
    if (!l.product.id && !l.product.category.trim()) problems.push(`${l.product.name}: type a category`);
    if (!(Number(l.qty) >= 1)) problems.push(`${l.product.name}: how many pieces?`);
    if (l.paid.trim() === "") problems.push(`${l.product.name}: how much did you pay for them?`);
  });

  const save = useAction(
    () =>
      api.post<Saved>("/trips", {
        date, place: place || undefined, notes: notes || undefined,
        items: calc.rows.map((r) => ({
          ...(r.l.product!.id ? { productId: r.l.product!.id } : { newProduct: { name: r.l.product!.name, category: r.l.product!.category.trim(), unit: r.l.product!.unit || "pcs" } }),
          qty: r.qty, linePaise: r.rawPaise, gstPct: r.gstPct || undefined, unitPricePaise: r.price,
        })),
        costs: costs.filter((c) => paise(c.amount) > 0).map((c) => ({ kind: c.kind.trim() || "Other", label: c.label || undefined, amountPaise: paise(c.amount), paidBy: c.paidBy || undefined })),
      }),
    { success: "Saved. Stock and prices are updated.", invalidate: ["products", "trips"], onSuccess: (r) => { setSaved(r); window.scrollTo({ top: 0, behavior: "smooth" }); } },
  );

  if (saved) return <Done saved={saved} onAgain={() => { setSaved(null); setLines([newLine()]); setCosts([newCost("Travel"), newCost("Food")]); setPlace(""); setNotes(""); }} onView={() => router.push(`/buy/${saved.id}`)} />;

  return (
    <div>
      <PageHeader title="New buy" subtitle="Type what you bought and what the trip cost. We work out the real cost of every piece, then you set your selling price." />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* trip details */}
          <Card>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <Field label="Date"><Input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Where did you buy?" className="sm:col-span-2"><Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Barabazar wholesale" /></Field>
            </div>
          </Card>

          {/* items */}
          <Card title="1. What did you buy?" subtitle="One row per item. Enter the total you paid for all the pieces of that item.">
            <div className="space-y-4 p-4 sm:p-6">
              <AnimatePresence initial={false}>
                {calc.rows.map((r, i) => (
                  <motion.div key={r.l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl border border-line/[0.1] bg-bg/60 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-muted">Item {i + 1}</span>
                      {lines.length > 1 && <button onClick={() => setLines((ls) => ls.filter((x) => x.id !== r.l.id))} className="flex items-center gap-1 text-[13.5px] text-muted hover:text-sindoor"><Trash2 className="h-4 w-4" />Remove</button>}
                    </div>
                    <ProductField
                      value={r.l.product}
                      catalog={cat?.items ?? []}
                      categories={(cat?.categories ?? []).map((c) => c.name)}
                      onChange={(p) => setLine(r.l.id, p?.id && p.sellingPricePaise ? { product: p, mode: "price", value: rupeeStr(p.sellingPricePaise) } : { product: p })}
                    />
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Field label="How many pieces?"><Input inputMode="numeric" value={r.l.qty} onChange={(e) => setLine(r.l.id, { qty: e.target.value.replace(/\D/g, "") })} placeholder="100" /></Field>
                      <Field label="Total you paid (₹)" className="col-span-1 sm:col-span-2"><Input inputMode="decimal" value={r.l.paid} onChange={(e) => setLine(r.l.id, { paid: e.target.value })} placeholder="1000" /></Field>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1.5 text-[14px] font-semibold">Add GST on top of this price?</div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Segmented value={r.l.gst ? "yes" : "no"} onChange={(v) => setLine(r.l.id, { gst: v === "yes" })} options={[{ value: "no", label: "No, already included" }, { value: "yes", label: "Yes, add GST" }]} />
                        {r.l.gst && <div className="flex items-center gap-2"><Input inputMode="decimal" className="w-24" value={r.l.gstPct} onChange={(e) => setLine(r.l.id, { gstPct: e.target.value })} aria-label="GST percentage" /><span className="text-[15px] text-muted">% GST{r.gstPct > 0 && r.rawPaise > 0 ? ` = ${formatINR(r.linePaise - r.rawPaise)} added` : ""}</span></div>}
                      </div>
                    </div>

                    {r.qty > 0 && r.linePaise > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl bg-primary-tint p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                          <span className="text-[14px] text-text/70">At the market <b className="font-semibold text-text">{formatINR(r.marketUnit)}</b> each</span>
                          <span className="text-[14px] text-text/70">Trip costs add <b className="font-semibold text-text">{formatINR(r.unit - r.marketUnit)}</b></span>
                          <span className="text-[16px]">Real cost <b className="text-[20px] font-semibold text-primary">{formatINR(r.unit)}</b> each</span>
                        </div>
                      </motion.div>
                    )}

                    {r.qty > 0 && r.unit > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 text-[14px] font-semibold">Your selling price <span className="font-normal text-muted">— change any one box, the others follow</span></div>
                        <div className="grid grid-cols-3 gap-3">
                          <Field label="Add / less ₹ each">
                            <Input inputMode="decimal" value={r.l.mode === "adjust" ? r.l.value : r.price ? String(r.adjustPaise / 100) : ""} onChange={(e) => setLine(r.l.id, { mode: "adjust", value: e.target.value })} placeholder="+30" />
                          </Field>
                          <Field label="% over cost">
                            <Input inputMode="decimal" value={r.l.mode === "pct" ? r.l.value : r.price ? String(r.pct) : ""} onChange={(e) => setLine(r.l.id, { mode: "pct", value: e.target.value })} placeholder="25" />
                          </Field>
                          <Field label="Selling price ₹">
                            <Input inputMode="decimal" value={r.l.mode === "price" ? r.l.value : r.price ? String(r.price / 100) : ""} onChange={(e) => setLine(r.l.id, { mode: "price", value: e.target.value })} placeholder="150" />
                          </Field>
                        </div>
                        {r.price > 0 && (
                          <div className={cn("mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14.5px] font-semibold", r.pct >= 0 ? "bg-leaf/10 text-leaf" : "bg-peach-tint text-peach")}>
                            {r.pct >= 0 ? "↑" : "↓"} {Math.abs(r.pct)}% {r.pct >= 0 ? "above" : "below"} cost · {r.adjustPaise >= 0 ? "profit" : "loss"} {formatINR(Math.abs(r.adjustPaise))} on each · {formatINR(r.qty * r.adjustPaise)} on all {r.qty}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="flex flex-wrap items-center gap-3">
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setLines((ls) => [...ls, newLine()])}>Add another item</Button>
                {calc.rows.filter((r) => r.unit > 0).length > 1 && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[14px] text-muted">Same % on all:</span>
                    <Input inputMode="decimal" value={bulkPct} onChange={(e) => setBulkPct(e.target.value)} placeholder="25" className="h-10 w-20" />
                    <Button size="sm" disabled={!bulkPct} onClick={applyToAll}>Apply</Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* trip costs */}
          <Card title="2. What did the trip cost?" subtitle="Travel, food for you and your helpers, toll, van, labour, anything else. These are added to the cost of the items.">
            <div className="space-y-3 p-4 sm:p-6">
              <AnimatePresence initial={false}>
                {costs.map((c) => (
                  <motion.div key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-[1fr_120px_auto] items-end gap-3 sm:grid-cols-[170px_1fr_130px_150px_auto]">
                    <Field label="Type" className="col-span-2 sm:col-span-1">
                      <Input list="cost-kinds" value={c.kind} onChange={(e) => setCost(c.id, { kind: e.target.value })} />
                    </Field>
                    <Field label="Note" className="hidden sm:block"><Input value={c.label} onChange={(e) => setCost(c.id, { label: e.target.value })} placeholder="e.g. Helper's lunch" /></Field>
                    <Field label="Amount (₹)"><Input inputMode="decimal" value={c.amount} onChange={(e) => setCost(c.id, { amount: e.target.value })} placeholder="250" /></Field>
                    <Field label="Paid by" className="hidden sm:block"><Input value={c.paidBy} onChange={(e) => setCost(c.id, { paidBy: e.target.value })} placeholder="Me / Raju" /></Field>
                    <button onClick={() => setCosts((cs) => cs.filter((x) => x.id !== c.id))} className="mb-1 grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-bg2 hover:text-sindoor" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <datalist id="cost-kinds">{COST_KINDS.map((k) => <option key={k} value={k} />)}</datalist>
              <div className="flex flex-wrap gap-2 pt-1">
                {COST_KINDS.map((k) => <button key={k} onClick={() => setCosts((cs) => [...cs, newCost(k)])} className="rounded-full border border-line/15 bg-panel px-3.5 py-1.5 text-[14px] font-semibold text-text/80 transition hover:border-primary hover:text-primary">+ {k}</button>)}
              </div>
              <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about this trip" /></Field>
            </div>
          </Card>
        </div>

        {/* live summary */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden">
            <div className="bg-primary-soft p-6">
              <div className="text-[15px] font-semibold text-primary">Total money put in</div>
              <div className="display mt-1 text-[44px] leading-none">{formatINR(calc.totals.totalPaise, { decimals: false })}</div>
              <div className="mt-2 text-[14.5px] text-text/70">{calc.totals.units.toLocaleString("en-IN")} pieces · {formatINR(calc.totals.itemsPaise, { decimals: false })} items + {formatINR(calc.totals.costsPaise, { decimals: false })} trip costs</div>
            </div>
            <div className="space-y-5 p-6">
              {costs.filter((c) => paise(c.amount) > 0).length > 0 && (
                <div>
                  <div className="mb-2 text-[14px] font-semibold">Trip costs</div>
                  {Object.entries(costs.reduce<Record<string, number>>((m, c) => ({ ...m, [c.kind || "Other"]: (m[c.kind || "Other"] ?? 0) + paise(c.amount) }), {})).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 text-[15px]"><span className="text-muted">{k}</span><span className="font-medium">{formatINR(v, { decimals: false })}</span></div>
                  ))}
                </div>
              )}
              <p className="text-[13.5px] text-muted">Trip costs are shared equally over every piece you bought.</p>
              {calc.expectedSales > 0 && (
                <div className="rounded-2xl bg-peach-tint p-4">
                  <div className="text-[14px] font-semibold text-peach">If you sell everything at your prices</div>
                  <div className="mt-1 flex items-baseline justify-between"><span className="text-[15px] text-text/70">You get</span><b className="text-[20px]">{formatINR(calc.expectedSales, { decimals: false })}</b></div>
                  {calc.allPriced ? (
                    <div className="mt-1 flex items-baseline justify-between"><span className="text-[15px] text-text/70">Profit</span><b className={cn("text-[20px]", calc.expectedSales - calc.totals.totalPaise >= 0 ? "text-leaf" : "text-sindoor")}>{formatINR(calc.expectedSales - calc.totals.totalPaise, { decimals: false })} ({pctOver(calc.totals.totalPaise, calc.expectedSales)}%)</b></div>
                  ) : (
                    <p className="mt-1 text-[13.5px] text-text/60">Set a price for every item to see the total profit.</p>
                  )}
                  <p className="mt-2 text-[12.5px] text-text/50">Before platform fees. Fees come from your monthly reports.</p>
                </div>
              )}
              {calc.unpriced > 0 && calc.totals.totalPaise > 0 && <p className="text-[14px] text-marigold">{calc.unpriced} {calc.unpriced === 1 ? "item has" : "items have"} no selling price yet. You can set it later.</p>}
              {problems.length > 0 && calc.totals.totalPaise >= 0 && (
                <ul className="space-y-1 rounded-xl bg-bg2 p-3 text-[14px] text-muted">{problems.slice(0, 4).map((p) => <li key={p}>• {p}</li>)}</ul>
              )}
              <Button variant="primary" size="lg" className="w-full" disabled={problems.length > 0} loading={save.isPending} icon={<ArrowRight className="h-5 w-5" />} onClick={() => save.mutate(undefined)}>Save this buy</Button>
              <p className="text-center text-[13px] text-muted">Saving adds the stock, sets your prices and keeps a record of the trip.</p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/** After saving: a plain confirmation with the next steps. */
function Done({ saved, onAgain, onView }: { saved: Saved; onAgain: () => void; onView: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="paar-card p-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf/10 text-leaf"><CheckCircle2 className="h-9 w-9" /></motion.div>
        <h1 className="display mt-5 text-[34px]">Saved</h1>
        <p className="mt-2 text-[16px] text-muted">{formatINR(saved.totalPaise, { decimals: false })} put in. Your stock and prices are up to date.</p>
        <div className="my-6" />
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onView}>See this buy</Button>
          <Button onClick={onAgain}>Record another</Button>
        </div>
        <p className="mt-6 text-[14px] text-muted">Expected profit on this lot: <b className="text-text">{compactINR(saved.expectedProfitPaise)}</b> before platform fees</p>
      </motion.div>
    </div>
  );
}
