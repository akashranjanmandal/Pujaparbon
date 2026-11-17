"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { groupOf, navFor } from "@/lib/nav";

/** Floating section dock. Click a section to open its tray; single-page sections navigate directly. */
export function Dock() {
  const { user } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [tray, setTray] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setTray(null), [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setTray(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!user) return null;
  const groups = navFor(user.permissions, user.role);
  const current = groupOf(path)?.id;
  const open = groups.find((g) => g.id === tray);

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="relative">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="paar-card absolute bottom-full left-1/2 mb-3 grid w-[min(92vw,560px)] -translate-x-1/2 grid-cols-2 gap-1 bg-bg2/95 p-1.5 sm:grid-cols-3"
            >
              {open.items.map((i) => (
                <Link key={i.href} href={i.href} className={cn("group rounded-lg p-3 transition hover:bg-line/[0.05]", path.startsWith(i.href) && "bg-line/[0.05]")}>
                  <i.icon className="h-4 w-4 text-muted group-hover:text-sindoor" />
                  <div className="mt-2 text-[13px] font-medium">{i.label}</div>
                  <div className="text-[11.5px] text-muted">{i.hint}</div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.nav
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", damping: 22 }}
          className="flex items-center gap-1 rounded-2xl border border-line/10 bg-bg2/80 p-1.5 shadow-lift backdrop-blur-2xl"
        >
          {groups.map((g) => {
            const active = current === g.id;
            return (
              <button
                key={g.id}
                onClick={() => (g.items.length === 1 ? router.push(g.items[0].href) : setTray(tray === g.id ? null : g.id))}
                className={cn("group relative flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium transition", active ? "text-text" : "text-muted hover:bg-line/[0.05] hover:text-text")}
              >
                {active && <motion.span layoutId="dock-active" className="absolute inset-0 rounded-xl border border-line/10 bg-line/[0.07]" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <g.icon className={cn("relative h-4 w-4 transition-transform group-hover:-translate-y-px", active && "text-sindoor")} />
                <span className="relative hidden sm:inline">{g.title}</span>
                {active && <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sindoor shadow-[0_0_6px_rgb(var(--sindoor))]" />}
              </button>
            );
          })}
        </motion.nav>
      </div>
    </div>
  );
}
