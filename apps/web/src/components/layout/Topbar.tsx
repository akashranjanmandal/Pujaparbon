"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { groupOf, navFor } from "@/lib/nav";
import { useTheme } from "@/lib/theme";

interface Note { id: string; level: "critical" | "warning" | "info"; title: string; body: string; href: string }

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="w-[86px]" />;
  return <span className="num font-mono text-[12px] text-muted">{now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" })} <span className="text-muted/50">IST</span></span>;
}

export function Topbar({ onSearch }: { onSearch: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const path = usePathname();
  const [open, setOpen] = useState<"alerts" | "me" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notes = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<Note[]>("/insights/notifications"), refetchInterval: 60_000, enabled: !!user });
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!user) return null;
  const group = navFor(user.permissions, user.role).find((g) => g.id === groupOf(path)?.id);
  const icon = "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-line/[0.06] hover:text-text";

  return (
    <header className="sticky top-0 z-30 border-b hairline bg-bg/75 backdrop-blur-xl" ref={ref}>
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href={user.role === "STAFF" ? "/me" : "/dashboard"}><Logo className="[&>div]:hidden sm:[&>div]:block" /></Link>
        <span className="hidden h-5 w-px bg-line/10 md:block" />
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted md:block">{user.tenant?.name ?? "Workspace"} · {user.role.toLowerCase()}</span>

        <button onClick={onSearch} className="mx-auto hidden h-8 w-full max-w-md items-center sm:flex gap-2.5 rounded-lg border border-line/10 bg-line/[0.03] px-3 text-left text-[13px] text-muted transition hover:border-line/20">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Search or jump to…</span>
          <kbd className="rounded border border-line/10 px-1.5 text-[10px]">⌘K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <button className={cn(icon, "sm:hidden")} onClick={onSearch} aria-label="Search"><Search className="h-4 w-4" /></button>
          <span className="mr-2 hidden items-center gap-3 lg:flex">
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-leaf"><span className="h-1.5 w-1.5 animate-dhak rounded-full bg-leaf shadow-[0_0_8px_rgb(var(--leaf))]" />Live</span>
            <Clock />
          </span>
          <button className={icon} onClick={toggle} title="Toggle theme">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <div className="relative">
            <button className={icon} onClick={() => setOpen(open === "alerts" ? null : "alerts")} aria-label="Alerts">
              <Bell className="h-4 w-4" />
              {notes.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sindoor shadow-[0_0_8px_rgb(var(--sindoor))]" />}
            </button>
            <AnimatePresence>
              {open === "alerts" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="paar-card fixed inset-x-3 top-14 mt-2 bg-bg2/95 p-1.5 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:w-[360px]">
                  <div className="label px-3 pb-2 pt-2.5">Needs attention · {notes.length}</div>
                  {notes.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-muted">All systems normal.</div>}
                  {notes.map((n) => (
                    <Link key={n.id} href={n.href} onClick={() => setOpen(null)} className="flex gap-3 rounded-lg px-3 py-2.5 transition hover:bg-line/[0.04]">
                      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.level === "critical" ? "bg-sindoor shadow-[0_0_8px_rgb(var(--sindoor))]" : n.level === "warning" ? "bg-marigold" : "bg-sky")} />
                      <span><span className="block text-[13px] font-medium">{n.title}</span><span className="block text-[12px] text-muted">{n.body}</span></span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative ml-1">
            <button onClick={() => setOpen(open === "me" ? null : "me")} className="rounded-full"><Avatar name={user.name} hue={user.avatarHue} size={28} /></button>
            <AnimatePresence>
              {open === "me" && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="paar-card absolute right-0 mt-2 w-56 bg-bg2/95 p-1.5">
                  <div className="px-3 py-2.5"><div className="text-[13px] font-medium">{user.name}</div><div className="text-[12px] text-muted">{user.email}</div></div>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted hover:bg-line/[0.04] hover:text-sindoor"><LogOut className="h-3.5 w-3.5" />Sign out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {group && group.items.length > 1 && (
        <nav className="flex h-10 items-end gap-1 overflow-x-auto px-4 sm:px-6">
          {group.items.map((i) => {
            const active = path === i.href || path.startsWith(`${i.href}/`);
            return (
              <Link key={i.href} href={i.href} className={cn("relative flex h-9 items-center gap-2 whitespace-nowrap px-3 text-[13px] transition-colors", active ? "text-text" : "text-muted hover:text-text")}>
                <i.icon className="h-3.5 w-3.5" />{i.label}
                {active && <motion.span layoutId="tab-ul" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-sindoor shadow-[0_0_10px_rgb(var(--sindoor))]" />}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
