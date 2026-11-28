"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { useAuth } from "@/lib/auth";
import { useActiveBusiness } from "@/lib/business";
import { cn } from "@/lib/cn";
import { Tr, useT } from "@/lib/i18n";
import { navFor } from "@/lib/nav";

/** Every page the person can open, always visible with big labels. On phones it slides in from the left. */
function Menu({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const biz = useActiveBusiness();
  const path = usePathname();
  const t = useT();
  if (!user) return null;
  const groups = navFor(user.permissions, user.role, biz.kind);
  const home = user.role === "STAFF" ? "/me" : "/dashboard";
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-3 pt-5"><Link href={home} onClick={onNavigate}><Logo /></Link></div>

      {user.role === "OWNER" && biz.chosen && (
        <Link href="/choose" onClick={onNavigate} className="mx-3 mb-2 flex items-center gap-3 rounded-2xl border border-line/10 bg-bg2 px-3.5 py-3 transition hover:border-primary">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[16px] font-semibold text-white" style={{ background: biz.business?.color ?? "rgb(var(--primary))" }}>{(biz.business?.name ?? "All")[0]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-semibold">{biz.business?.name ?? t("All businesses together")}</span>
            <span className="flex items-center gap-1 text-[13px] text-primary"><ArrowLeftRight className="h-3.5 w-3.5" />{t("Switch business")}</span>
          </span>
        </Link>
      )}

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-3">
        {groups.map((g) => (
          <div key={g.id}>
            {g.items.length > 1 && <div className="mb-1.5 px-3 text-[12.5px] font-semibold uppercase tracking-wide text-muted"><Tr>{g.title}</Tr></div>}
            <div className="space-y-0.5">
              {g.items.map((i) => {
                const active = path === i.href || path.startsWith(`${i.href}/`);
                return (
                  <Link key={i.href} href={i.href} onClick={onNavigate} title={t(i.hint)}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[16px] font-medium transition-colors", active ? "bg-primary text-white shadow-soft" : "text-text/80 hover:bg-line/[0.06] hover:text-text")}>
                    <i.icon className={cn("h-5 w-5 shrink-0", active ? "text-white" : "text-primary")} />
                    <span className="truncate"><Tr>{i.label}</Tr></span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between border-t hairline px-4 py-3"><LangSwitch /></div>
    </div>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  useEffect(() => onClose(), [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r hairline bg-panel lg:block"><Menu /></aside>
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="fixed inset-y-0 left-0 z-50 w-[288px] max-w-[86vw] bg-panel shadow-lift">
              <button onClick={onClose} className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-line/[0.06]" aria-label="Close menu"><X className="h-5 w-5" /></button>
              <Menu onNavigate={onClose} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
