"use client";
import { Select } from "@/components/ui/primitives";
import type { Business } from "@/lib/types";

/** A dropdown of the family's businesses. An empty value means "shared by all". */
export function BusinessSelect({ value, onChange, list, none = "Shared by all businesses" }: { value: string; onChange: (v: string) => void; list?: Business[]; none?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{none}</option>
      {list?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  );
}
