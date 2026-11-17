"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./primitives";

export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; align?: "right" | "center" }

export function Table<T extends { id?: string }>({ columns, rows, loading, onRowClick, empty, rowKey, selected, onToggle }: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  rowKey?: (r: T) => string;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const key = (r: T, i: number) => rowKey?.(r) ?? r.id ?? String(i);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {onToggle && <th className="w-10 border-b hairline px-4 py-3" />}
            {columns.map((c) => (
              <th key={c.key} className={cn("border-b hairline px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  {onToggle && <td className="px-4 py-3.5" />}
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3.5"><Skeleton className="h-4 w-3/4" /></td>
                  ))}
                </tr>
              ))
            : rows?.map((r, i) => (
                <motion.tr
                  key={key(r, i)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.35 }}
                  onClick={() => onRowClick?.(r)}
                  className={cn("group transition-colors", onRowClick && "cursor-pointer", "hover:bg-gold/[0.04]", selected?.has(key(r, i)) && "bg-sindoor/[0.06]")}
                >
                  {onToggle && (
                    <td className="border-b border-line/[0.06] px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected?.has(key(r, i)) ?? false} onChange={() => onToggle(key(r, i))} className="h-4 w-4 accent-[rgb(var(--sindoor))]" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("border-b border-line/[0.06] px-4 py-3 align-middle", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </motion.tr>
              ))}
        </tbody>
      </table>
      {!loading && rows && rows.length === 0 && empty}
    </div>
  );
}
