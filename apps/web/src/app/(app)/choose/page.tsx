"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Loader } from "@/components/ui/Loader";
import { api } from "@/lib/api";
import { useActiveBusiness } from "@/lib/business";
import { useT } from "@/lib/i18n";
import type { Business } from "@/lib/types";

/** Shown right after sign-in: which business does he want to open? */
export default function ChoosePage() {
  const router = useRouter();
  const t = useT();
  const { choose, id } = useActiveBusiness();
  const { data: list } = useQuery({ queryKey: ["businesses"], queryFn: () => api.get<Business[]>("/businesses") });
  const go = (v: string) => { choose(v); router.replace("/dashboard"); };
  if (!list) return <Loader />;
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="eyebrow">{t("Welcome")}</div>
      <h1 className="display mt-1 text-[36px] leading-tight sm:text-[44px]">{t("Which business do you want to open?")}</h1>
      <p className="mt-2 text-[16px] text-muted">{t("Each business has its own stock, sales, costs and profit. You can switch any time from the top bar.")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {list.map((b, i) => (
          <motion.button key={b.id} onClick={() => go(b.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-4 rounded-2xl border border-line/10 bg-panel p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[22px] font-semibold text-white" style={{ background: b.color }}>{b.name[0]}</span>
            <span><span className="block text-[18px] font-semibold">{b.name}</span>{id === b.id && <span className="text-[13.5px] text-primary">{t("Open now")}</span>}</span>
          </motion.button>
        ))}
        <motion.button onClick={() => go("ALL")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: list.length * 0.05 }}
          className="flex items-center gap-4 rounded-2xl border border-dashed border-line/30 bg-bg2 p-5 text-left transition hover:border-primary sm:col-span-2">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-white"><LayoutGrid className="h-6 w-6" /></span>
          <span><span className="block text-[18px] font-semibold">{t("All businesses together")}</span><span className="text-[14px] text-muted">{t("Combined view of everything")}</span></span>
        </motion.button>
      </div>
    </div>
  );
}
