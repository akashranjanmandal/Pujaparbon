"use client";
import { Select } from "@/components/ui/primitives";
import { useActiveBusiness } from "@/lib/business";
import type { Business } from "@/lib/types";

/**
 * Which business a record belongs to. While one business is open it is fixed to that business, because the
 * businesses are kept apart: to enter something for another, switch to it first. `any` is for the few places
 * that really choose between businesses (salaries, moving money, setting up places).
 */
export function BusinessSelect({ value, onChange, list, none = "Choose…", any = false }: { value: string; onChange: (v: string) => void; list?: Business[]; none?: string; any?: boolean }) {
  const { id } = useActiveBusiness();
  if (id && !any) {
    const b = list?.find((x) => x.id === id);
    return <Select value={id} disabled onChange={() => onChange(id)}><option value={id}>{b?.name ?? "This business"}</option></Select>;
  }
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{none}</option>
      {list?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  );
}
