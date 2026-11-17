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
              className="paar-card absolute bottom-full left-1/2 mb-3 grid w-[min(92vw,600px)] -translate-x-1/2 grid-cols-2 gap-1 p-2 shadow-lift sm:grid-cols-3"
            >
              {open.items.map((i) => (
                <Link key={i.href} href={i.href} className={cn("group rounded-xl p-3.5 transition hover:bg-primary-tint", path.startsWith(i.href) && "bg-primary-tint")}>
                  <i.icon className="h-5 w-5 text-primary" />
                  <div className="mt-2.5 text-[16px] font-semibold">{i.label}</div>
                  <div className="text-[14px] text-muted">{i.hint}</div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.nav
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", damping: 22 }}
          className="flex items-center gap-1 rounded-[22px] border border-line/[0.08] bg-panel/95 p-1.5 shadow-lift backdrop-blur-xl"
        >
          {groups.map((g) => {
            const active = current === g.id;
            return (
              <button
                key={g.id}
                onClick={() => (g.items.length === 1 ? router.push(g.items[0].href) : setTray(tray === g.id ? null : g.id))}
                className={cn("group relative flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[15px] font-semibold transition", active ? "text-white" : "text-muted hover:bg-bg2 hover:text-text")}
              >
                {active && <motion.span layoutId="dock-active" className="absolute inset-0 rounded-2xl bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <g.icon className="relative h-[18px] w-[18px]" />
                <span className="relative hidden sm:inline">{g.title}</span>
              </button>
            );
          })}
        </motion.nav>
      </div>
    </div>
  );
}
