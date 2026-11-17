"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Check, PartyPopper, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Button, Card, Field, Input, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Leave { id: string; employeeName: string; avatarHue: number; type: string; from: string; to: string; days: number; reason: string; status: string; createdAt: string }
interface Holiday { id: string; date: string; name: string }

export default function LeavePage() {
  const { data } = useQuery({ queryKey: ["leaves"], queryFn: () => api.get<Leave[]>("/leaves") });
  const { data: holidays } = useQuery({ queryKey: ["holidays"], queryFn: () => api.get<Holiday[]>("/leaves/holidays") });
  const decide = useAction(({ id, status }: { id: string; status: string }) => api.patch(`/leaves/${id}`, { status }), { success: "Decision saved", invalidate: ["leaves"] });
  const [h, setH] = useState({ date: todayKey(), name: "" });
  const addHoliday = useAction(() => api.post("/leaves/holidays", h), { success: "Holiday added", invalidate: ["holidays"], onSuccess: () => setH({ ...h, name: "" }) });
  const pending = data?.filter((l) => l.status === "PENDING") ?? [];
  const upcoming = holidays?.filter((x) => x.date >= todayKey()) ?? [];

  return (
    <div>
      <PageHeader title="Leave & holidays" subtitle="Approve requests in one tap. Approved paid leave flows straight into payroll." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Waiting for you" subtitle={`${pending.length} request${pending.length === 1 ? "" : "s"}`}>
            <div className="space-y-3 p-5">
              <AnimatePresence>
                {pending.map((l) => (
                  <motion.div key={l.id} layout exit={{ opacity: 0, x: 60 }} className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold/20 bg-gold/[0.05] p-4">
                    <Avatar name={l.employeeName} hue={l.avatarHue} size={44} />
                    <div className="min-w-[180px] flex-1">
                      <div className="font-semibold">{l.employeeName}</div>
                      <div className="text-sm text-muted">{l.type.toLowerCase()} · {fmtDate(l.from)}{l.to !== l.from ? ` – ${fmtDate(l.to)}` : ""} · {l.days} day{l.days > 1 ? "s" : ""}</div>
                      <div className="mt-1 text-sm">“{l.reason}”</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" icon={<X className="h-4 w-4" />} onClick={() => decide.mutate({ id: l.id, status: "REJECTED" })}>Decline</Button>
                      <Button variant="primary" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => decide.mutate({ id: l.id, status: "APPROVED" })}>Approve</Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!pending.length && <div className="py-8 text-center text-sm text-muted">No pending requests. 🌼</div>}
            </div>
          </Card>
          <Card title="History">
            <div className="space-y-2 p-5">
              {data?.filter((l) => l.status !== "PENDING").map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl bg-panel2/40 px-4 py-2.5 text-sm">
                  <Avatar name={l.employeeName} hue={l.avatarHue} size={28} />
                  <span className="flex-1">{l.employeeName} · {fmtDate(l.from)}{l.to !== l.from ? ` – ${fmtDate(l.to)}` : ""} · <span className="text-muted">{l.reason}</span></span>
                  <StatusBadge status={l.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card title="Festival calendar" subtitle="Holidays are excluded from working days">
          <div className="space-y-2 p-5">
            {upcoming.map((x, i) => (
              <motion.div key={x.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-4 rounded-2xl border border-line/10 bg-bg2/60 p-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-line/10 bg-line/[0.04] text-center leading-none">
                  <div><div className="text-[15px] font-semibold">{Number(x.date.slice(8))}</div><div className="text-[10px] uppercase text-muted">{fmtDate(x.date, { month: "short" })}</div></div>
                </div>
                <div className="font-medium">{x.name}</div>
              </motion.div>
            ))}
            <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-2 border-t hairline pt-4">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date"><Input type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} /></Field>
                <Field label="Name"><Input value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} placeholder="Jamai Shashthi" /></Field>
              </div>
              <Button variant="gold" icon={<PartyPopper className="h-4 w-4" />} disabled={h.name.length < 2} onClick={() => addHoliday.mutate(undefined)}>Add</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
