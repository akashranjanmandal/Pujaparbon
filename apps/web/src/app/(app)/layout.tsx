"use client";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Dock } from "@/components/layout/Dock";
import { Topbar } from "@/components/layout/Topbar";
import { Loader } from "@/components/ui/Loader";
import { useAuth } from "@/lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);
  if (!ready || !user) return <Loader label="Authenticating" />;

  return (
    <div className="relative min-h-screen">
      <Topbar onSearch={() => setPalette(true)} />
      <motion.main key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} className="mx-auto max-w-[1480px] px-4 pb-32 pt-6 sm:px-6">
        {children}
      </motion.main>
      <Dock />
      <CommandPalette open={palette} setOpen={setPalette} />
    </div>
  );
}
