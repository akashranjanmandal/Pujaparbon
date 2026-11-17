"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Page title with its Bengali name above — every screen speaks both languages. */
export function PageHeader({ title, bn, subtitle, actions }: { title: string; bn?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
        {bn && <div className="mb-1 font-bangla text-sm text-gold/90">{bn}</div>}
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </motion.div>
      {actions && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-wrap items-center gap-2">{actions}</motion.div>}
    </div>
  );
}
