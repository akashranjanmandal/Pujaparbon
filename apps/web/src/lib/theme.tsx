"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
interface ThemeState { theme: Theme; toggle: () => void }
const Ctx = createContext<ThemeState>({ theme: "dark", toggle: () => {} });

const read = () => { try { return localStorage.getItem("pp_theme"); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem("pp_theme", v); } catch { /* private mode */ } };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { const t = read(); if (t === "light" || t === "dark") setTheme(t); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; write(n); return n; }) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
