"use client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Business } from "./types";

const KEY = "pp.business";
interface Ctx { ready: boolean; chosen: boolean; id: string | undefined; business: Business | undefined; kind: Business["kind"] | undefined; choose: (id: string | "ALL") => void; clear: () => void }
const C = createContext<Ctx | null>(null);

/**
 * Which business the owner is looking at. He picks it right after signing in (and can switch any time);
 * "ALL" shows everything together. Kept per browser tab, so each new sign-in asks again.
 */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pick, setPick] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setPick(typeof window === "undefined" ? null : sessionStorage.getItem(KEY)); setReady(true); }, []);
  useEffect(() => { if (!user) { sessionStorage.removeItem(KEY); setPick(null); } }, [user]);
  const { data: list } = useQuery({ queryKey: ["businesses"], queryFn: () => api.get<Business[]>("/businesses"), enabled: !!user && user.role === "OWNER", staleTime: 5 * 60_000 });
  const value = useMemo<Ctx>(() => {
    const business = pick && pick !== "ALL" ? list?.find((b) => b.id === pick) : undefined;
    return {
      ready, chosen: !!pick, id: business?.id, business, kind: business?.kind,
      choose: (id) => { sessionStorage.setItem(KEY, id); setPick(id); },
      clear: () => { sessionStorage.removeItem(KEY); setPick(null); },
    };
  }, [pick, list, ready]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useActiveBusiness() {
  const v = useContext(C);
  if (!v) throw new Error("useActiveBusiness outside BusinessProvider");
  return v;
}
