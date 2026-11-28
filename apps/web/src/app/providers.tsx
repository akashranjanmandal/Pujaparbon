"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { BusinessProvider } from "@/lib/business";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => n < 1 && !(e as { status?: number }).status } } }),
  );
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <LangProvider><AuthProvider><BusinessProvider>{children}</BusinessProvider></AuthProvider></LangProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            className: "!bg-panel2 !text-text !border !border-line/20 !rounded-2xl !shadow-glow !font-sans",
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
