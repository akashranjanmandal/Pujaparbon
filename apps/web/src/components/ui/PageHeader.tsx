"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NAV } from "@/lib/nav";

/** Title row with a breadcrumb eyebrow derived from the navigation map. */
export function PageHeader({ title, subtitle, actions }: { title: string; bn?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const path = usePathname();
  const group = NAV.find((g) => g.items.some((i) => path === i.href || path.startsWith(`${i.href}/`)));
  return (
    <div className="mb-6 flex flex-col gap-4 border-b hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="label mb-2 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-sindoor" />
          {group?.title ?? "Seller OS"} <span className="text-muted/40">/</span> <span className="text-text/70">{title}</span>
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] text-muted">{subtitle}</p>}
      </motion.div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
