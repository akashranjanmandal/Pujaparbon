"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EXPENSE_CATEGORIES, toPaise } from "@pp/shared";
import { Donut } from "@/components/charts/Donut";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { compactINR, fmtDate, formatINR, monthKey, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Exp { id: string; date: string; category: string; amountPaise: number; note: string | null }
const COLORS = ["#E8323F", "#E9B452", "#F47A30", "#5CB880", "#6EA8FF", "#C46BD6", "#9C8F86"];

export default function ExpensesPage() {
  const [month, setMonth] = useState(monthKey());
  const { data } = useQuery({ queryKey: ["expenses", month], queryFn: () => api.get<{ items: Exp[]; totalPaise: number; byCategory: Record<string, number> }>(`/expenses?month=${month}`) });
  const [f, setF] = useState({ date: todayKey(), category: "Packaging", amount: "", note: "" });
  const add = useAction(() => api.post("/expenses", { date: f.date, category: f.category, amountPaise: toPaise(f.amount || 0), note: f.note }), { success: "Expense recorded", invalidate: ["expenses", "analytics"], onSuccess: () => setF({ ...f, amount: "", note: "" }) });
  const del = useAction((id: string) => api.del(`/expenses/${id}`), { success: "Deleted", invalidate: ["expenses", "analytics"] });
  const cats = Object.entries(data?.byCategory ?? {});
  return (
    <div>
      <PageHeader title="Expenses" subtitle="Rent, packaging, transport and the rest. These feed straight into the profit & loss." actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Add an expense">
            <div className="grid items-end gap-3 p-5 sm:grid-cols-5">
              <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
              <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Amount ₹"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
              <Field label="Note"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} disabled={!Number(f.amount)} loading={add.isPending} onClick={() => add.mutate(undefined)}>Add</Button>
            </div>
          </Card>
          <Card plain className="overflow-hidden">
            <Table rows={data?.items} loading={!data} empty={<div className="py-10 text-center text-sm text-muted">No expenses this month.</div>} columns={[
              { key: "d", header: "Date", cell: (e) => fmtDate(e.date) },
              { key: "c", header: "Category", cell: (e) => <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[EXPENSE_CATEGORIES.indexOf(e.category as never)] }} />{e.category}</span> },
              { key: "n", header: "Note", cell: (e) => <span className="text-muted">{e.note}</span> },
              { key: "a", header: "Amount", align: "right", cell: (e) => <b className="num">{formatINR(e.amountPaise, { decimals: false })}</b> },
              { key: "x", header: "", align: "right", cell: (e) => <button className="text-muted hover:text-sindoor" onClick={() => confirm("Delete this expense?") && del.mutate(e.id)}><Trash2 className="h-4 w-4" /></button> },
            ]} />
          </Card>
        </div>
        <Card title="Where it went">
          <div className="flex flex-col items-center gap-4 p-5">
            <Donut data={cats.map(([c, v]) => ({ name: c, value: v, color: COLORS[EXPENSE_CATEGORIES.indexOf(c as never)] }))} label={compactINR(data?.totalPaise ?? 0)} sub="this month" />
            <ul className="w-full space-y-2 text-sm">{cats.sort((a, b) => b[1] - a[1]).map(([c, v]) => <li key={c} className="flex justify-between"><span className="text-muted">{c}</span><b className="num">{formatINR(v, { decimals: false })}</b></li>)}</ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
