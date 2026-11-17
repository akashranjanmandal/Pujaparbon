"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NAV } from "@/lib/nav";

/** Section eyebrow + editorial serif title. */
export function PageHeader({ title, subtitle, actions }: { title: string; bn?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const path = usePathname();
  const group = NAV.find((g) => g.items.some((i) => path === i.href || path.startsWith(`${i.href}/`)));
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="eyebrow mb-1.5">{group?.title ?? "Seller OS"}</div>
        <h1 className="display text-[32px] leading-[1.1] sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[16px] text-muted">{subtitle}</p>}
      </motion.div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
