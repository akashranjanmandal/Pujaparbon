"use client";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Loader } from "@/components/ui/Loader";
import { useAuth } from "@/lib/auth";
import { useActiveBusiness } from "@/lib/business";
import { allowedWhenAll } from "@/lib/nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const biz = useActiveBusiness();
  const needsChoice = !!user && user.role === "OWNER" && biz.ready && !biz.chosen && path !== "/choose";

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);
  useEffect(() => { if (needsChoice) router.replace("/choose"); }, [needsChoice, router]);
  // Looking at all businesses together shows money only, so the working pages are closed in that view.
  const allView = !!user && user.role === "OWNER" && biz.chosen && !biz.id;
  const blocked = allView && !allowedWhenAll(path);
  useEffect(() => { if (blocked) router.replace("/dashboard"); }, [blocked, router]);
  if (!ready || !user || needsChoice || blocked) return <Loader label="Authenticating" />;

  if (path === "/choose") return <div className="min-h-screen px-4 sm:px-6">{children}</div>;

  return (
    <div className="relative min-h-screen">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <div className="lg:pl-[272px]">
        <Topbar onSearch={() => setPalette(true)} onMenu={() => setMenu(true)} />
        <motion.main key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className="mx-auto max-w-[1480px] px-4 pb-16 pt-6 sm:px-6">
          {children}
        </motion.main>
      </div>
      <CommandPalette open={palette} setOpen={setPalette} />
    </div>
  );
}
