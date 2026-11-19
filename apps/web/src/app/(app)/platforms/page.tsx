"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Plus, Store } from "lucide-react";
import { PLATFORM_COLORS, SUGGESTED_PLATFORMS } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Card, Empty, Field, Input } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compactINR } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Platform { id: string; name: string; color: string; reports: number; lastSalesMonth: string | null; monthNetPaise: number; monthOrders: number; totalNetPaise: number }
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const prevMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

export default function PlatformsPage() {
  const [adding, setAdding] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["platforms"], queryFn: () => api.get<Platform[]>("/platforms") });
  const last = prevMonth();
  return (
    <div>
      <PageHeader title="Platforms" subtitle="The marketplaces you sell on. Each month, upload their sales report and invoice, and your profit figures stay up to date."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add a platform</Button>} />
      {!isLoading && data?.length === 0 && (
        <Card><Empty icon={<Store />} title="No platforms yet" body="Add Flipkart, Amazon, Meesho or any other place you sell. You choose the names." action={<Button variant="primary" onClick={() => setAdding(true)}>Add your first platform</Button>} /></Card>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data?.map((p, i) => {
          const upToDate = p.lastSalesMonth !== null && p.lastSalesMonth >= last;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link href={`/platforms/${p.id}`} className="paar-card group block p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl text-[20px] font-semibold text-white" style={{ background: p.color }}>{p.name[0]}</span>
                  <div><div className="text-[20px] font-semibold">{p.name}</div><div className="text-[14px] text-muted">{p.reports} {p.reports === 1 ? "file" : "files"} uploaded</div></div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div><div className="text-[13.5px] text-muted">Received this month</div><div className="display text-[28px] leading-tight">{compactINR(p.monthNetPaise)}</div></div>
                  <div><div className="text-[13.5px] text-muted">Orders this month</div><div className="display text-[28px] leading-tight">{p.monthOrders}</div></div>
                </div>
                <div className={cn("mt-5 rounded-xl px-3.5 py-2.5 text-[14.5px] font-medium", upToDate ? "bg-leaf/10 text-leaf" : "bg-peach-tint text-peach")}>
                  {p.lastSalesMonth === null ? "No sales report uploaded yet" : upToDate ? `Sales report up to date (${monthName(p.lastSalesMonth)})` : `Upload the ${monthName(last)} report`}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
      <AddPlatform open={adding} onClose={() => setAdding(false)} existing={data?.map((p) => p.name.toLowerCase()) ?? []} />
    </div>
  );
}

function AddPlatform({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: string[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PLATFORM_COLORS[0]);
  const save = useAction(() => api.post("/platforms", { name, color }), { success: "Platform added", invalidate: ["platforms"], onSuccess: () => { setName(""); onClose(); } });
  return (
    <Drawer open={open} onClose={onClose} title="Add a platform" subtitle="Pick a common one, or type any name."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate(undefined)}>Add</Button></>}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PLATFORMS.filter((s) => !existing.includes(s.name.toLowerCase())).map((s) => (
            <button key={s.name} onClick={() => { setName(s.name); setColor(s.color); }} className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-semibold transition", name === s.name ? "border-primary bg-primary-tint" : "border-line/15 hover:border-primary")}><span className="h-3 w-3 rounded-full" style={{ background: s.color }} />{s.name}</button>
          ))}
        </div>
        <Field label="Platform name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flipkart" /></Field>
        <div>
          <div className="mb-2 text-[13.5px] font-semibold text-text/80">Colour in charts</div>
          <div className="flex flex-wrap gap-2">{PLATFORM_COLORS.map((c) => <button key={c} onClick={() => setColor(c)} aria-label={c} className={cn("h-10 w-10 rounded-full ring-offset-2 ring-offset-panel transition", color === c && "ring-2 ring-text")} style={{ background: c }} />)}</div>
        </div>
      </div>
    </Drawer>
  );
}
