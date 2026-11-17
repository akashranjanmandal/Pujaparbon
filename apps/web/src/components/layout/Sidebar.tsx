"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Diya } from "@/components/brand/Diya";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { navFor } from "@/lib/nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const path = usePathname();
  if (!user) return null;
  const sections = navFor(user.permissions, user.role);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {sections.map((s, si) => (
          <div key={s.title}>
            <div className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted/70">
              <span className="h-px w-3 bg-gold/40" />
              {s.title}
            </div>
            <ul className="space-y-0.5">
              {s.items.map((item, i) => {
                const active = path === item.href || path.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <motion.li key={item.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * (si * 3 + i) }}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active ? "text-text" : "text-muted hover:text-text")}
                    >
                      {active && (
                        <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-gold/25 bg-gradient-to-r from-sindoor/20 via-panel2 to-transparent shadow-glow" transition={{ type: "spring", bounce: 0.18, duration: 0.6 }} />
                      )}
                      {active && <motion.span layoutId="nav-bar" className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-gold to-sindoor" />}
                      <span className="relative z-10 grid h-5 w-5 place-items-center">
                        {active ? <Diya size={22} /> : <Icon className="h-[18px] w-[18px] transition-transform group-hover:scale-110" strokeWidth={1.7} />}
                      </span>
                      <span className="relative z-10 flex-1 font-medium">{item.label}</span>
                      <span className="relative z-10 font-bangla text-[11px] text-gold/0 transition-colors group-hover:text-gold/70">{item.bn}</span>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-2xl border border-line/10 bg-panel/60 p-3">
        <Avatar name={user.name} hue={user.avatarHue} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-muted">{user.designation}</div>
        </div>
        <button onClick={logout} className="rounded-lg p-2 text-muted transition hover:bg-sindoor/10 hover:text-sindoor" aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
