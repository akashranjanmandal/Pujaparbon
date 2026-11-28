"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useActiveBusiness } from "@/lib/business";
import { cn } from "@/lib/cn";

interface Note { id: string; level: "critical" | "warning" | "info"; title: string; body: string; href: string }

export function Topbar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { user, logout } = useAuth();
  const biz = useActiveBusiness();
  const [open, setOpen] = useState<"alerts" | "me" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notes = [] } = useQuery({ queryKey: ["notifications", biz.id ?? ""], queryFn: () => api.get<Note[]>("/insights/notifications"), refetchInterval: 60_000, enabled: !!user && !!biz.id });
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!user) return null;
  const icon = "relative grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-line/[0.05] hover:text-text";

  return (
    <header className="sticky top-0 z-30 border-b hairline bg-bg/85 backdrop-blur-xl" ref={ref}>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
        <button onClick={onMenu} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-text hover:bg-line/[0.06] lg:hidden" aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <Link href={user.role === "STAFF" ? "/me" : "/dashboard"} className="shrink-0 lg:hidden"><Logo className="[&>div:last-child]:hidden sm:[&>div:last-child]:block" /></Link>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={onSearch} className="hidden h-10 items-center gap-2.5 rounded-xl border border-line/[0.1] bg-panel px-3.5 text-[15px] text-muted shadow-[0_1px_2px_rgb(var(--line)/0.04)] transition hover:border-line/20 md:flex md:w-64">
            <Search className="h-4 w-4" /><span className="flex-1 text-left">Search anything</span><kbd className="rounded-md bg-bg2 px-1.5 py-0.5 text-[11px]">⌘K</kbd>
          </button>
          <button className={cn(icon, "md:hidden")} onClick={onSearch} aria-label="Search"><Search className="h-[18px] w-[18px]" /></button>
          <div className="relative">
            <button className={icon} onClick={() => setOpen(open === "alerts" ? null : "alerts")} aria-label="Alerts">
              <Bell className="h-[18px] w-[18px]" />
              {notes.length > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-peach px-1 text-[10px] font-bold text-white">{notes.length}</span>}
            </button>
            <AnimatePresence>
              {open === "alerts" && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="paar-card fixed inset-x-3 top-16 mt-1 p-2 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:w-[380px]">
                  <div className="px-3 pb-2 pt-2 text-[16px] font-semibold">Needs your attention</div>
                  {notes.length === 0 && <div className="px-3 py-6 text-center text-[15px] text-muted">Nothing urgent right now.</div>}
                  {notes.map((n) => (
                    <Link key={n.id} href={n.href} onClick={() => setOpen(null)} className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-bg2">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.level === "critical" ? "bg-sindoor" : n.level === "warning" ? "bg-peach" : "bg-primary")} />
                      <span><span className="block text-[15.5px] font-semibold">{n.title}</span><span className="block text-[14.5px] text-muted">{n.body}</span></span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative">
            <button onClick={() => setOpen(open === "me" ? null : "me")} className="ml-1 flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition hover:bg-line/[0.05]">
              <Avatar name={user.name} hue={user.avatarHue} size={34} />
              <span className="hidden text-left leading-tight xl:block"><span className="block text-[15px] font-semibold">{user.name}</span><span className="block text-[13.5px] text-muted">{user.designation}</span></span>
            </button>
            <AnimatePresence>
              {open === "me" && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="paar-card absolute right-0 mt-2 w-60 p-2 shadow-lift">
                  <div className="px-3 py-2"><div className="text-[15.5px] font-semibold">{user.name}</div><div className="text-[14px] text-muted">{user.email}</div></div>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-bg2 hover:text-sindoor"><LogOut className="h-4 w-4" />Sign out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
