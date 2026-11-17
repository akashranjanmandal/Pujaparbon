"use client";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { navFor } from "@/lib/nav";

interface Results {
  products: { id: string; name: string; emoji: string | null; sku: string }[];
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
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, setOpen]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  const item = "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted aria-selected:bg-panel2 aria-selected:text-text";
  const group = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-gold/80";

  return (
    <AnimatePresence>
      {open && user && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="paar-card relative w-full max-w-xl bg-bg2/95">
            <Command shouldFilter={q.length < 2} label="Search everything">
              <div className="flex items-center gap-3 border-b hairline px-5 pt-2">
                <Search className="h-5 w-5 text-gold" />
                <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search SKUs, orders, people, pages…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/60" />
                <kbd className="rounded-md border border-line/20 px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-muted">Nothing found for “{q}”.</Command.Empty>
                {q.length < 2 &&
                  navFor(user.permissions, user.role).map((s) => (
                    <Command.Group key={s.title} heading={s.title} className={group}>
                      {s.items.map((i) => (
                        <Command.Item key={i.href} value={`${i.label} ${i.bn}`} onSelect={() => go(i.href)} className={item}>
                          <i.icon className="h-4 w-4" /> {i.label} <span className="ml-auto font-bangla text-xs text-gold/60">{i.bn}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                {!!data?.products.length && (
                  <Command.Group heading="Products" className={group}>
                    {data.products.map((p) => (
                      <Command.Item key={p.sku} value={p.sku} onSelect={() => go(`/products/${p.id}`)} className={item}>
                        <span className="text-lg">{p.emoji}</span> {p.name} <code className="ml-auto text-xs text-gold/70">{p.sku}</code>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {!!data?.orders.length && (
                  <Command.Group heading="Orders" className={group}>
                    {data.orders.map((o) => (
                      <Command.Item key={o.id} value={o.id} onSelect={() => go(`/orders?open=${o.id}`)} className={item}>
                        <code className="text-xs text-gold/80">{o.channelOrderId}</code> {o.customerName} <span className="ml-auto text-xs">{o.status}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {!!data?.employees.length && (
                  <Command.Group heading="Team" className={group}>
                    {data.employees.map((e) => (
                      <Command.Item key={e.id} value={e.id} onSelect={() => go(`/hr/employees/${e.id}`)} className={item}>
                        {e.name} <span className="ml-auto text-xs">{e.designation}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {!!data?.suppliers.length && (
                  <Command.Group heading="Suppliers" className={group}>
                    {data.suppliers.map((s) => (
                      <Command.Item key={s.id} value={s.id} onSelect={() => go(`/purchases?supplier=${s.id}`)} className={item}>
                        {s.name} <span className="ml-auto text-xs">{s.city}</span>
                      </Command.Item>
                    ))}
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
