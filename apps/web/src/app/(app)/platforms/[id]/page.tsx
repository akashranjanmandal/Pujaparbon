"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, RotateCcw, Trash2, Upload } from "lucide-react";
import { SALES_FIELDS, formatINR } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { Loader } from "@/components/ui/Loader";
import { RangePicker, rangeFor, type RangeValue } from "@/components/ui/RangePicker";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api, download } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactINR, fmtDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { paise } from "@/lib/money";
import type { Product } from "@/lib/summary";

interface Rep { id: string; kind: "SALES" | "INVOICE"; month: string; from: string | null; to: string | null; fileName: string; size: number; rowsImported: number; rowsSkipped: number; amountPaise: number | null; note: string | null; createdAt: number }
interface Tracker { platform: { id: string; name: string; color: string; hasMapping: boolean }; reports: Rep[] }
interface Preview { rows: number; returns: boolean; headers: string[]; mapping: Record<string, string>; missing: string[]; usedSaved: boolean; sample: Record<string, string>[] }
interface Summary { totals: { grossPaise: number; feesPaise: number; netPaise: number; cogsPaise: number; profitPaise: number; orders: number; returnOrders: number }; states: { state: string; netPaise: number }[]; products: { best: { name: string; profitPaise: number; units: number }[] } }
const span = (r: Rep) => (r.from && r.to ? (r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`) : null);

export default function PlatformPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [range, setRange] = useState<RangeValue>(rangeFor("month"));
  const [upload, setUpload] = useState<{ kind: "SALES" | "INVOICE" } | null>(null);
  const { data: t } = useQuery({ queryKey: ["platform", id], queryFn: () => api.get<Tracker>(`/platforms/${id}`) });
  const { data: s } = useQuery({ queryKey: ["summary", id, range.from, range.to], queryFn: () => api.get<Summary>(`/insights/summary?from=${range.from}&to=${range.to}&platformId=${id}`) });
  const del = useAction((rid: string) => api.del(`/platforms/reports/${rid}`), { success: "Removed", invalidate: ["platform", "platforms", "summary"] });
  const resetMap = useAction(() => api.patch(`/platforms/${id}`, { resetMapping: true }), { success: "Column matching forgotten. You will match them again on the next upload.", invalidate: ["platform"] });
  const removePlatform = useAction(() => api.del(`/platforms/${id}`), { success: "Platform removed", invalidate: ["platforms"], onSuccess: () => router.push("/platforms") });
  if (!t) return <Loader />;
  const p = t.platform;
  const x = s?.totals;

  return (
    <div className="space-y-6">
      <button onClick={() => router.push("/platforms")} className="flex items-center gap-2 text-[15px] text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Platforms</button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-[24px] font-semibold text-white" style={{ background: p.color }}>{p.name[0]}</span>
          <div><div className="eyebrow">Platform</div><h1 className="display text-[36px] leading-tight">{p.name}</h1></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setUpload({ kind: "SALES" })}>Upload sales report</Button>
          <Button icon={<FileText className="h-4 w-4" />} onClick={() => setUpload({ kind: "INVOICE" })}>Upload invoice</Button>
        </div>
      </div>

      <RangePicker value={range} onChange={setRange} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Sold (before fees)" value={compactINR(x?.grossPaise ?? 0)} sub={`${x?.orders ?? 0} orders`} tone="bg-primary-soft text-primary" />
        <Tile label="Platform fees" value={compactINR(x?.feesPaise ?? 0)} sub={x && x.grossPaise ? `${Math.round((x.feesPaise / x.grossPaise) * 1000) / 10}% of sales` : undefined} tone="bg-peach-soft text-peach" />
        <Tile label="You received" value={compactINR(x?.netPaise ?? 0)} sub={x?.returnOrders ? `${x.returnOrders} returned` : undefined} tone="bg-lav-soft text-lav" />
        <Tile label="Profit on these sales" value={compactINR(x?.profitPaise ?? 0)} sub="After cost of items" tone="bg-panel text-leaf" />
      </div>

      <Card title="Uploaded reports" subtitle="Add the report as it comes from the platform, for any period. The dates inside it decide which months it counts in; re-uploading overlapping reports never double counts." plain className="overflow-hidden">
        {t.reports.length === 0 ? <div className="px-6 py-8 text-[15px] text-muted">Nothing uploaded yet.</div> : (
          <div className="divide-y divide-line/[0.06] px-6 py-2">
            {t.reports.map((r) => <ReportRow key={r.id} r={r} onDelete={() => confirm(r.kind === "SALES" ? `Remove ${r.fileName}? Its sales will be taken out of your profit figures.` : `Remove ${r.fileName}?`) && del.mutate(r.id)} />)}
          </div>
        )}
      </Card>

      <Unmatched platformId={id} />

      <Card title="Settings for this platform">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div className="max-w-xl text-[15px] text-muted">{p.hasMapping ? "We remember how this platform's report columns match. If its file layout changes, forget the matching and match them again on the next upload." : "The first upload asks you to confirm which column is which, then it is remembered."}</div>
          <div className="flex gap-2">
            {p.hasMapping && <Button icon={<RotateCcw className="h-4 w-4" />} onClick={() => resetMap.mutate(undefined)}>Forget column matching</Button>}
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => confirm(`Remove ${p.name} and everything uploaded for it? This cannot be undone.`) && removePlatform.mutate(undefined)}>Remove platform</Button>
          </div>
        </div>
      </Card>

      {upload && <UploadDrawer platformId={id} initial={upload} onClose={() => setUpload(null)} />}
    </div>
  );
}

const Tile = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) => (
  <div className={`rounded-2xl p-5 ${tone}`}><div className="text-[14px] font-semibold">{label}</div><div className="display mt-1 text-[30px] leading-none text-text">{value}</div>{sub && <div className="mt-2 text-[13.5px] text-text/60">{sub}</div>}</div>
);

function ReportRow({ r, onDelete }: { r: Rep; onDelete: () => void }) {
  const dates = span(r);
  return (
    <div className="flex items-center gap-3 py-3">
      {r.kind === "SALES" ? <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" /> : <FileText className="h-5 w-5 shrink-0 text-peach" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{r.fileName}</div>
        <div className="text-[13px] text-muted">{r.kind === "SALES" ? `${r.rowsImported} sales read${r.rowsSkipped ? ` · ${r.rowsSkipped} skipped` : ""}${dates ? ` · orders ${dates}` : ""}` : r.amountPaise ? `Invoice · fees ${formatINR(r.amountPaise, { decimals: false })}` : "Invoice saved"} · uploaded {fmtDate(r.createdAt)}</div>
      </div>
      <button onClick={() => download(`/platforms/reports/${r.id}/file`, r.fileName)} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-primary" aria-label="Download"><Download className="h-4 w-4" /></button>
      <button onClick={onDelete} className="rounded-lg p-2 text-muted hover:bg-panel hover:text-sindoor" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

/** Sold items whose platform name did not match any of his products. He links each once. */
function Unmatched({ platformId }: { platformId: string }) {
  const { data } = useQuery({ queryKey: ["unmatched", platformId], queryFn: () => api.get<{ name: string; units: number; netPaise: number }[]>(`/platforms/${platformId}/unmatched`) });
  const { data: prods } = useQuery({ queryKey: ["products", ""], queryFn: () => api.get<{ items: Product[] }>("/products") });
  const map = useAction(({ alias, productId }: { alias: string; productId: string }) => api.post(`/platforms/${platformId}/aliases`, { alias, productId }), { success: "Matched. This is remembered for next time.", invalidate: ["unmatched", "summary", "notifications", "home"] });
  if (!data?.length) return null;
  return (
    <Card title="Match these sold items to your products" subtitle="The platform uses a different name for these. Pick your product once and every report matches by itself, so the cost counts in your profit.">
      <div className="divide-y divide-line/[0.06]">
        {data.map((u) => (
          <div key={u.name} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_260px] md:items-center">
            <div><div className="text-[15.5px] font-semibold">{u.name}</div><div className="text-[13.5px] text-muted">{u.units} sold · {formatINR(u.netPaise, { decimals: false })} received</div></div>
            <Select defaultValue="" onChange={(e) => e.target.value && map.mutate({ alias: u.name, productId: e.target.value })}>
              <option value="">Choose your product…</option>
              {prods?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UploadDrawer({ platformId, initial, onClose }: { platformId: string; initial: { kind: "SALES" | "INVOICE" }; onClose: () => void }) {
  const [kind, setKind] = useState(initial.kind);
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ imported: number; duplicates: number; unmatched: number; issues: { row: number; message: string }[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const read = useAction((f: File) => { const fd = new FormData(); fd.append("file", f); return api.upload<Preview>(`/platforms/${platformId}/preview`, fd); }, { onSuccess: (r) => { setPrev(r); setMapping(r.mapping); } });
  const pick = (f: File | null) => { setFile(f); setPrev(null); setResult(null); if (f && kind === "SALES") read.mutate(f); };
  const missing = prev ? (!mapping.amount ? ["Sale amount"] : []).concat(!mapping.product && !mapping.sku ? ["Product name or SKU"] : []) : [];
  const send = useAction(() => {
    const fd = new FormData();
    fd.append("file", file!); fd.append("kind", kind);
    if (kind === "SALES") fd.append("mapping", JSON.stringify(mapping));
    if (amount) fd.append("amountPaise", String(paise(amount)));
    if (note) fd.append("note", note);
    return api.upload<NonNullable<typeof result>>(`/platforms/${platformId}/reports`, fd);
  }, { invalidate: ["platform", "platforms", "summary", "unmatched", "notifications", "home"], onSuccess: (r) => setResult(r) });

  return (
    <Drawer open onClose={onClose} wide title={kind === "SALES" ? "Upload a sales report" : "Upload an invoice"} subtitle={kind === "SALES" ? "Download an orders or settlement report from the platform for any period and add it here. Dates come from the file." : "Keep the platform's invoice safely with your records."}
      footer={result ? <Button variant="primary" onClick={onClose}>Done</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={send.isPending} disabled={!file || (kind === "SALES" && (!prev || missing.length > 0))} onClick={() => send.mutate(undefined)}>{kind === "SALES" ? "Read this report" : "Save invoice"}</Button></>}>
      {result ? (
        <div className="space-y-5 py-4 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-leaf" />
          <div className="display text-[30px]">{kind === "SALES" ? `${result.imported} sales added` : "Invoice saved"}</div>
          {kind === "SALES" && (
            <div className="mx-auto max-w-md space-y-2 text-left text-[15.5px]">
              {result.duplicates > 0 && <p className="rounded-xl bg-bg2 p-3">{result.duplicates} rows were already uploaded before, so they were not counted twice.</p>}
              {result.unmatched > 0 && <p className="rounded-xl bg-peach-tint p-3 text-peach">{result.unmatched} sold {result.unmatched === 1 ? "item does" : "items do"} not match your products yet. Match them on this page so their cost counts in your profit.</p>}
              {result.issues.slice(0, 5).map((i) => <p key={i.row} className="text-[14px] text-muted">Row {i.row}: {i.message}</p>)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What is it?"><Select value={kind} onChange={(e) => { setKind(e.target.value as "SALES" | "INVOICE"); setPrev(null); if (file && e.target.value === "SALES") read.mutate(file); }}><option value="SALES">Sales or returns report (Excel or CSV)</option><option value="INVOICE">Platform invoice (PDF, Excel or photo)</option></Select></Field>
          </div>
          <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0] ?? null); }} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line/25 bg-bg/60 px-6 py-10 text-center transition hover:border-primary">
            <Upload className="h-7 w-7 text-primary" />
            <span className="text-[17px] font-semibold">{file ? file.name : "Choose a file or drop it here"}</span>
            <span className="text-[14px] text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : kind === "SALES" ? ".csv or .xlsx" : ".pdf, .xlsx, .csv or a photo"}</span>
          </button>
          <input ref={input} type="file" accept={kind === "SALES" ? ".csv,.xlsx" : ".pdf,.xlsx,.csv,.png,.jpg,.jpeg"} className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {kind === "SALES" && <button onClick={() => download("/platforms/sample.csv", "sales-report-template.csv")} className="text-[14.5px] font-semibold text-primary hover:underline">Download an example file</button>}

          {kind === "INVOICE" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fees on this invoice (₹)" hint="Optional"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Note" hint="Optional"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
          )}

          <AnimatePresence>
            {kind === "SALES" && prev && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className={cn("rounded-xl p-4 text-[15px]", missing.length ? "bg-peach-tint text-peach" : "bg-leaf/10 text-leaf")}>
                  {missing.length ? <>We could not tell which column is the <b>{missing.join(" and ")}</b>. Choose them below.</> : <>Found {prev.rows} rows. {prev.returns ? "This looks like a returns report, so every row is counted as a return, not a sale. " : ""}{prev.usedSaved ? "Using the column matching you set earlier." : "Check the matching below."}</>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SALES_FIELDS.map((f) => (
                    <Field key={f.key} label={`${f.label}${f.required || f.key === "product" ? " *" : ""}`}>
                      <Select value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value) n[f.key] = e.target.value; else delete n[f.key]; return n; })}>
                        <option value="">— not in this file —</option>
                        {prev.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </Select>
                    </Field>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-xl border border-line/10">
                  <table className="w-full text-[13.5px]"><thead><tr className="bg-bg2">{prev.headers.slice(0, 8).map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{prev.sample.map((r, i) => <tr key={i} className="border-t border-line/[0.06]">{prev.headers.slice(0, 8).map((h) => <td key={h} className="px-3 py-2">{r[h]}</td>)}</tr>)}</tbody></table>
                </div>
                <p className="text-[13.5px] text-muted">* One of Product name or SKU is needed. Everything else is optional; missing fees are treated as zero.</p>
              </motion.div>
            )}
          </AnimatePresence>
          {read.isPending && <p className="text-[15px] text-muted">Reading the file…</p>}
        </div>
      )}
    </Drawer>
  );
}
