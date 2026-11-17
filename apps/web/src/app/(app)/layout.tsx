"use client";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AlpanaLoader } from "@/components/brand/AlpanaLoader";
import { Shiuli } from "@/components/brand/Shiuli";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { utsav } = useTheme();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) return <AlpanaLoader />;

  return (
    <div className="relative min-h-screen">
      {utsav && <div className="pointer-events-none fixed inset-0 z-0 opacity-60"><Shiuli density={12} /></div>}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r hairline bg-bg2/80 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>
      <AnimatePresence>
        {menu && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 28 }} className="absolute inset-y-0 left-0 w-[280px] border-r hairline bg-bg2">
              <Sidebar onNavigate={() => setMenu(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="relative z-10 lg:pl-[264px]">
        <Topbar onMenu={() => setMenu(true)} onSearch={() => setPalette(true)} />
        <AnimatePresence mode="wait">
          <motion.main
            key={path}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="mx-auto max-w-[1440px] px-4 pb-20 pt-7 sm:px-8"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
      <CommandPalette open={palette} setOpen={setPalette} />
    </div>
  );
}
