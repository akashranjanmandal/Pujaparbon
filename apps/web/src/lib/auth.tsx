"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Permission } from "@pp/shared";
import { api, lastUser, onSessionExpired, refreshSession, setAccessToken } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    refreshSession().then((ok) => {
      if (ok) setUser(lastUser as User);
      setReady(true);
    });
    return onSessionExpired(() => {
      setAccessToken(null);
      setUser(null);
      router.replace("/login?expired=1");
    });
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: User }>("/auth/login", { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, logout, can: (p) => !!user?.permissions.includes(p) }),
    [user, ready, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
};

/** Where each role lands after login. */
export const homeFor = (u: User) => (u.role === "STAFF" ? "/me" : "/dashboard");
