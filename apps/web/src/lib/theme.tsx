"use client";
import type { ReactNode } from "react";

/** Single light theme by design decision; provider kept so the tree shape does not change. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
