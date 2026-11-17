"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./primitives";

export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; align?: "right" | "center"; /** Hide on phones. */ hideMobile?: boolean }

/**
 * Data table on tablets and desktops; on phones every row becomes a stacked card
 * (first column as the title, the rest as label/value pairs) so nothing needs sideways scrolling.
 */
export function Table<T extends object>({ columns, rows, loading, onRowClick, empty, rowKey, selected, onToggle }: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  rowKey?: (r: T) => string;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const key = (r: T, i: number) => rowKey?.(r) ?? (r as { id?: string }).id ?? String(i);
  const [first, ...rest] = columns;
  return (
    <>
      {/* Phone: cards */}
      <div className="divide-y divide-line/[0.06] md:hidden">
        {loading && Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2 p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>)}
        {!loading && rows?.map((r, i) => (
          <div key={key(r, i)} onClick={() => onRowClick?.(r)} className={cn("flex gap-3 p-4 active:bg-line/[0.04]", selected?.has(key(r, i)) && "bg-sindoor/[0.06]")}>
            {onToggle && <input type="checkbox" checked={selected?.has(key(r, i)) ?? false} onClick={(e) => e.stopPropagation()} onChange={() => onToggle(key(r, i))} className="mt-1 h-4 w-4 accent-[rgb(var(--sindoor))]" />}
            <div className="min-w-0 flex-1">
              <div className="text-[14px]">{first.cell(r)}</div>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                {rest.filter((c) => !c.hideMobile).map((c) => (
                  <div key={c.key} className="min-w-0">
                    {c.header ? <dt className="label !text-[9.5px]">{c.header}</dt> : null}
                    <dd className="mt-0.5 truncate text-[13px]">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet & desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {onToggle && <th className="w-10 border-b hairline bg-bg2/40 px-4 py-2.5" />}
              {columns.map((c) => (
                <th key={c.key} className={cn("border-b hairline bg-bg2/40 px-4 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {onToggle && <td className="px-4 py-3" />}
                    {columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-3/4" /></td>)}
                  </tr>
                ))
              : rows?.map((r, i) => (
                  <motion.tr
                    key={key(r, i)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.012, 0.25), duration: 0.25 }}
                    onClick={() => onRowClick?.(r)}
                    className={cn("group transition-colors hover:bg-line/[0.025]", onRowClick && "cursor-pointer", selected?.has(key(r, i)) && "bg-sindoor/[0.06]")}
                  >
                    {onToggle && (
                      <td className="border-b border-line/[0.05] px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected?.has(key(r, i)) ?? false} onChange={() => onToggle(key(r, i))} className="h-4 w-4 accent-[rgb(var(--sindoor))]" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("border-b border-line/[0.05] px-4 py-2.5 align-middle text-[13px]", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && rows && rows.length === 0 && empty}
    </>
  );
}
