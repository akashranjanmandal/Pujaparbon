"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Right-side sheet on desktop, bottom sheet on phones. Escape closes. */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-[rgb(28_32_46/0.35)] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.6 }}
            transition={{ type: "spring", damping: 34, stiffness: 320 }}
            className={cn("absolute bottom-0 right-0 top-0 flex w-full flex-col bg-panel shadow-lift sm:rounded-l-[28px]", wide ? "max-w-3xl" : "max-w-xl")}
          >
            <header className="flex items-start justify-between gap-4 px-7 pb-4 pt-7">
              <div>
                <h2 className="display text-[26px] leading-tight">{title}</h2>
                {subtitle && <p className="mt-1.5 text-[15.5px] text-muted">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-muted transition hover:bg-panel2 hover:text-text" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-7 py-4">{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t hairline bg-panel2/60 px-7 py-4">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
