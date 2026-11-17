"use client";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { navFor } from "@/lib/nav";

interface Results {
  products: { id: string; name: string; sku: string }[];
  orders: { id: string; channelOrderId: string; customerName: string; status: string }[];
  employees: { id: string; name: string; designation: string }[];
  suppliers: { id: string; name: string; city: string | null }[];
}

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["search", q], queryFn: () => api.get<Results>(`/insights/search?q=${encodeURIComponent(q)}`), enabled: open && q.length >= 2 });

  useEffect(() => {
    let g = false;
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!open); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "g") { g = true; setTimeout(() => (g = false), 800); return; }
      if (g && user) {
        const hit = navFor(user.permissions, user.role).flatMap((x) => x.items).find((i) => i.key === `g ${e.key}`);
        if (hit) router.push(hit.href);
        g = false;
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, setOpen, router, user]);

  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };
  const item = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted aria-selected:bg-line/[0.06] aria-selected:text-text";
  const group = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-muted";

  return (
    <AnimatePresence>
      {open && user && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[14vh]">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.98, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }} className="paar-card relative w-full max-w-xl bg-bg2/95 shadow-lift">
            <Command shouldFilter={q.length < 2} label="Command menu">
              <div className="flex items-center gap-3 border-b hairline px-4">
                <Search className="h-4 w-4 text-muted" />
                <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search SKUs, orders, people — or jump to a page" className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted/60" />
                <kbd className="rounded border border-line/10 px-1.5 text-[10px] text-muted">ESC</kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">No results for “{q}”.</Command.Empty>
                {q.length < 2 && navFor(user.permissions, user.role).map((g) => (
                  <Command.Group key={g.id} heading={g.title} className={group}>
                    {g.items.map((i) => (
                      <Command.Item key={i.href} value={`${i.label} ${i.hint}`} onSelect={() => go(i.href)} className={item}>
                        <i.icon className="h-4 w-4" /> {i.label} <span className="text-[12px] text-muted/70">{i.hint}</span>
                        {i.key ? <kbd className="ml-auto rounded border border-line/10 px-1.5 text-[10px]">{i.key.toUpperCase()}</kbd> : <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0" />}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
                {!!data?.products.length && (
                  <Command.Group heading="Products" className={group}>
                    {data.products.map((p) => <Command.Item key={p.sku} value={p.sku} onSelect={() => go(`/products/${p.id}`)} className={item}><ProductGlyph name={p.name} size={22} /> {p.name} <code className="ml-auto text-[11px]">{p.sku}</code></Command.Item>)}
                  </Command.Group>
                )}
                {!!data?.orders.length && (
                  <Command.Group heading="Orders" className={group}>
                    {data.orders.map((o) => <Command.Item key={o.id} value={o.id} onSelect={() => go(`/orders?open=${o.id}`)} className={item}><code className="text-[12px] text-text">{o.channelOrderId}</code> {o.customerName} <span className="ml-auto font-mono text-[10px] uppercase">{o.status}</span></Command.Item>)}
                  </Command.Group>
                )}
                {!!data?.employees.length && (
                  <Command.Group heading="People" className={group}>
                    {data.employees.map((e) => <Command.Item key={e.id} value={e.id} onSelect={() => go(`/hr/employees/${e.id}`)} className={item}>{e.name} <span className="ml-auto text-[12px]">{e.designation}</span></Command.Item>)}
                  </Command.Group>
                )}
                {!!data?.suppliers.length && (
                  <Command.Group heading="Suppliers" className={group}>
                    {data.suppliers.map((s) => <Command.Item key={s.id} value={s.id} onSelect={() => go(`/purchases?supplier=${s.id}`)} className={item}>{s.name} <span className="ml-auto text-[12px]">{s.city}</span></Command.Item>)}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
