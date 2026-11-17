"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, Menu, Moon, Search, Sparkles, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme";

interface Note { id: string; level: "critical" | "warning" | "info"; title: string; body: string; href: string }

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { user } = useAuth();
  const { theme, toggle, utsav, setUtsav } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notes = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<Note[]>("/insights/notifications"), refetchInterval: 60_000, enabled: !!user });

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const icon = "grid h-10 w-10 place-items-center rounded-xl border border-line/10 bg-panel/50 text-muted transition hover:border-gold/40 hover:text-text";
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b hairline bg-bg/70 px-4 py-3 backdrop-blur-xl sm:px-8">
      <button className={cn(icon, "lg:hidden")} onClick={onMenu} aria-label="Menu"><Menu className="h-5 w-5" /></button>
      <button onClick={onSearch} className="group flex h-10 flex-1 items-center gap-3 rounded-xl border border-line/10 bg-panel/50 px-4 text-left text-sm text-muted transition hover:border-gold/40 sm:max-w-md">
        <Search className="h-4 w-4 text-gold/80" />
        <span className="flex-1 truncate">Search SKU, order ID, employee…</span>
        <kbd className="hidden rounded-md border border-line/20 px-1.5 py-0.5 text-[10px] sm:block">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border border-leaf/25 bg-leaf/10 px-3 py-1.5 text-xs font-medium text-leaf md:flex">
          <span className="relative h-2 w-2"><span className="absolute inset-0 animate-dhak rounded-full bg-leaf" /></span>
          Live
        </span>
        <button className={cn(icon, utsav && "border-gold/40 text-gold")} onClick={() => setUtsav(!utsav)} title={utsav ? "Utsav mode on — festive effects" : "Utsav mode off"}>
          <Sparkles className="h-[18px] w-[18px]" />
        </button>
        <button className={icon} onClick={toggle} title={theme === "sandhya" ? "Switch to Prabhat (light)" : "Switch to Sandhya (dark)"}>
          {theme === "sandhya" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <div className="relative" ref={ref}>
          <button className={icon} onClick={() => setOpen((o) => !o)} aria-label="Alerts">
            <Bell className="h-[18px] w-[18px]" />
            {notes.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sindoor px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgb(var(--sindoor))]">{notes.length}</span>}
          </button>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="paar-card absolute right-0 mt-2 w-[340px] bg-bg2/95 p-2">
                <div className="px-3 pb-2 pt-3 font-display text-base">What needs you today</div>
                {notes.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted">All calm. Nothing urgent.</div>}
                {notes.map((n) => (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl px-3 py-2.5 transition hover:bg-panel2">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.level === "critical" ? "bg-sindoor shadow-[0_0_8px_rgb(var(--sindoor))]" : n.level === "warning" ? "bg-marigold" : "bg-sky")} />
                    <span>
                      <span className="block text-sm font-medium">{n.title}</span>
                      <span className="block text-xs text-muted">{n.body}</span>
                    </span>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
