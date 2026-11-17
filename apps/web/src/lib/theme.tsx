"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "sandhya" | "prabhat";
interface ThemeState { theme: Theme; toggle: () => void; utsav: boolean; setUtsav: (v: boolean) => void }
const Ctx = createContext<ThemeState>({ theme: "sandhya", toggle: () => {}, utsav: false, setUtsav: () => {} });

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: preference just won't persist */
  }
};

/** Sandhya = evening aarti (dark). Prabhat = morning (light). Utsav = festival mode: more shiuli, more glow. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("sandhya");
  const [utsav, setUtsavState] = useState(true);
  useEffect(() => {
    const t = read("pp_theme");
    if (t === "prabhat" || t === "sandhya") setTheme(t);
    setUtsavState(read("pp_utsav") !== "0");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <Ctx.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => {
          const n = t === "sandhya" ? "prabhat" : "sandhya";
          write("pp_theme", n);
          return n;
        }),
        utsav,
        setUtsav: (v) => {
          write("pp_utsav", v ? "1" : "0");
          setUtsavState(v);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
