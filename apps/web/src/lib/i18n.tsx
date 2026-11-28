"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BN } from "./i18n-bn";

export type Lang = "en" | "bn";
const KEY = "pp.lang";
const C = createContext<{ lang: Lang; setLang: (l: Lang) => void } | null>(null);
const DICT: Record<Lang, Record<string, string>> = { en: {}, bn: BN };

/**
 * Screens are written in English; this swaps in the Bengali for any string that has one, and shows English otherwise.
 * To add a language, add a dictionary file and an entry in DICT and LANGS.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => { const s = localStorage.getItem(KEY); if (s === "bn" || s === "en") setLangState(s); }, []);
  const value = useMemo(() => ({ lang, setLang: (l: Lang) => { localStorage.setItem(KEY, l); setLangState(l); document.documentElement.lang = l; } }), [lang]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const LANGS: { value: Lang; label: string }[] = [{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }];

export function useLang() {
  const v = useContext(C);
  if (!v) throw new Error("useLang outside LangProvider");
  return v;
}
export function useT() {
  const { lang } = useLang();
  return (s: string) => DICT[lang][s] ?? s;
}
/** Translates children when they are plain text; anything else passes through. */
export function Tr({ children }: { children: ReactNode }) {
  const t = useT();
  return <>{typeof children === "string" ? t(children) : children}</>;
}
