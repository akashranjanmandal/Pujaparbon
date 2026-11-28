"use client";
import { Languages } from "lucide-react";
import { LANGS, useLang } from "@/lib/i18n";

export function LangSwitch() {
  const { lang, setLang } = useLang();
  const next = LANGS.find((l) => l.value !== lang)!;
  return (
    <button onClick={() => setLang(next.value)} className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-[14.5px] font-semibold text-muted transition hover:bg-line/[0.05] hover:text-text" title={`Switch to ${next.label}`}>
      <Languages className="h-[18px] w-[18px]" /><span className="hidden sm:inline">{next.label}</span>
    </button>
  );
}
