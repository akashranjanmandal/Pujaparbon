"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Plus } from "lucide-react";
import { TASK_PRIORITIES } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar, Button, Field, Input, Select, StatusBadge, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDate, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import type { Employee } from "../employees/page";

interface Task { id: string; title: string; description: string | null; dueDate: string; priority: string; status: "TODO" | "IN_PROGRESS" | "DONE"; employeeName: string; avatarHue: number }
const COLS = [{ s: "TODO", t: "To do" }, { s: "IN_PROGRESS", t: "In progress" }, { s: "DONE", t: "Done" }] as const;

export default function TasksPage() {
  const [adding, setAdding] = useState(false);
  const { data } = useQuery({ queryKey: ["tasks"], queryFn: () => api.get<Task[]>("/tasks") });
  const move = useAction(({ id, status }: { id: string; status: string }) => api.patch(`/tasks/${id}/status`, { status }), { invalidate: ["tasks"] });
  const [drag, setDrag] = useState<string | null>(null);
  return (
    <div>
      <PageHeader title="Tasks" subtitle="Assign work and watch it move. Staff update their own tasks from their phone." actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Assign task</Button>} />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
        {COLS.map((c) => {
          const items = data?.filter((t) => t.status === c.s) ?? [];
          return (
            <div key={c.s} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move.mutate({ id: drag, status: c.s })} className="paar-card min-h-[300px] w-[84vw] shrink-0 snap-center p-4 lg:w-auto">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="rounded-full bg-panel2 px-2.5 py-1 text-[15.5px] font-semibold">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((t) => {
                  const overdue = t.status !== "DONE" && t.dueDate < todayKey();
                  return (
                    <motion.div layout key={t.id} draggable onDragStartCapture={() => setDrag(t.id)} className={cn("cursor-grab rounded-2xl border bg-bg2/70 p-4", overdue ? "border-sindoor/40" : "border-line/10")}>
                      <div className="flex items-start justify-between gap-2"><div className={cn("font-medium", t.status === "DONE" && "text-muted line-through")}>{t.title}</div><StatusBadge status={t.priority} /></div>
                      <div className="mt-3 flex items-center justify-between text-[14px] text-muted">
                        <span className="flex items-center gap-2"><Avatar name={t.employeeName} hue={t.avatarHue} size={22} />{t.employeeName}</span>
                        <span className={overdue ? "font-semibold text-sindoor" : ""}>{overdue ? "Overdue · " : ""}{fmtDate(t.dueDate)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {adding && <AddTask onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddTask({ onClose }: { onClose: () => void }) {
  const { data: emps } = useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/employees") });
  const [f, setF] = useState({ employeeId: "", title: "", description: "", dueDate: todayKey(), priority: "MEDIUM" });
  const save = useAction(() => api.post("/tasks", { ...f, employeeId: f.employeeId || emps?.[0]?.id }), { success: "Task assigned", invalidate: ["tasks", "employees"], onSuccess: onClose });
  return (
    <Drawer open onClose={onClose} title="Assign a task" footer={<Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>Assign</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Task" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Pack the Meesho bulk order" /></Field>
        <Field label="Assign to"><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>{emps?.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}</Select></Field>
        <Field label="Due"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}
