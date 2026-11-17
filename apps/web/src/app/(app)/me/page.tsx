"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, LocateFixed, LogIn, LogOut, MapPin, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { LEAVE_TYPES } from "@pp/shared";
import { Loader } from "@/components/ui/Loader";
import { Button, Card, Field, Input, Select, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { deviceId } from "@/lib/device";
import { fmtDate, fmtTime, todayKey } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { capture, getPosition, offsetMeters, openCamera, type Fix } from "@/lib/presence";

interface Me {
  employee: { id: string; name: string; designation: string; avatarHue: number } | null;
  record: { status: string; checkInAt: string | null; checkOutAt: string | null; checkInDistanceM: number | null } | null;
  fence: { lat: number; lng: number; radiusM: number; shiftStart: string; shiftEnd: string; graceMin: number; name: string } | null;
  month?: { present: number; late: number; leave: number };
}
interface Task { id: string; title: string; dueDate: string; priority: string; status: "TODO" | "IN_PROGRESS" | "DONE" }
interface Leave { id: string; type: string; from: string; to: string; days: number; status: string; reason: string }

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function MyDay() {
  const { user } = useAuth();
  const { data: me, refetch } = useQuery({ queryKey: ["me"], queryFn: () => api.get<Me>("/attendance/me") });
  if (!me) return <Loader label="Loading your shift" />;
  if (!me.employee) return <div className="py-20 text-center text-muted">Your login is not linked to an employee record. Ask the owner to link it in Settings.</div>;
  const state = me.record?.checkOutAt ? "DONE" : me.record?.checkInAt ? "IN" : "OUT";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="border-b hairline pb-5">
        <div className="label mb-2 flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sindoor" />My shift</div>
        <h1 className="text-[24px] font-semibold tracking-tight">Hi {user?.name.split(" ")[0]}, ready for today?</h1>
        <div className="mt-1 font-mono text-[12px] text-muted">{fmtDate(new Date(), { weekday: "short", day: "numeric", month: "short" }).toUpperCase()} · SHIFT {me.fence?.shiftStart}–{me.fence?.shiftEnd} · {me.employee.designation.toUpperCase()}</div>
      </div>
      <PresenceCard me={me} state={state} onDone={refetch} />
      {me.month && (
        <div className="grid grid-cols-3 gap-3">
          {[["Present", me.month.present, "text-leaf"], ["Late", me.month.late, "text-marigold"], ["Leave", me.month.leave, "text-sky"]].map(([l, n, c]) => (
            <div key={l as string} className="paar-card p-4"><div className="label">{l as string} · month</div><div className={cn("mt-2 font-mono text-[26px]", c as string)}>{n as number}</div></div>
          ))}
        </div>
      )}
      <MyTasks />
      <MyLeave />
    </div>
  );
}

function PresenceCard({ me, state, onDone }: { me: Me; state: "OUT" | "IN" | "DONE"; onDone: () => void }) {
  const fence = me.fence!;
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [simulate, setSimulate] = useState(false);
  const [step, setStep] = useState<"idle" | "camera" | "sending" | "success">("idle");
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<(() => void) | null>(null);

  const locate = async () => {
    setLocating(true);
    setLocError("");
    try {
      setFix(simulate ? { lat: fence.lat + 0.00012, lng: fence.lng - 0.00009, accuracyM: 12 } : await getPosition());
    } catch (e) {
      setLocError((e as Error).message);
    } finally {
      setLocating(false);
    }
  };
  useEffect(() => { locate(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [simulate]);
  useEffect(() => () => stop.current?.(), []);

  const off = fix ? offsetMeters(fence, fix) : null;
  const inside = !!off && off.d <= fence.radiusM && fix!.accuracyM <= fence.radiusM;

  const startCamera = async () => {
    setError("");
    setShot(null);
    setStep("camera");
    try {
      await new Promise((r) => setTimeout(r, 50));
      stop.current = await openCamera(video.current!);
    } catch (e) {
      setError((e as Error).message);
      setStep("idle");
    }
  };
  const submit = async () => {
    if (!shot || !fix) return;
    setStep("sending");
    try {
      await api.post(`/attendance/${state === "OUT" ? "check-in" : "check-out"}`, { ...fix, deviceId: deviceId(), selfie: shot });
      stop.current?.();
      setStep("success");
      setTimeout(() => { setStep("idle"); onDone(); }, 3200);
    } catch (e) {
      setError((e as Error).message);
      setStep("camera");
    }
  };

  // Radar scale: the fence circle is drawn at 40% of the radius of the radar.
  const R = 140, fenceR = R * 0.4, scale = fenceR / fence.radiusM;
  const dot = off ? { x: Math.max(-R + 10, Math.min(R - 10, off.dx * scale)), y: Math.max(-R + 10, Math.min(R - 10, -off.dy * scale)) } : null;

  return (
    <Card className="overflow-hidden">
      <div className="relative grid gap-6 p-6 sm:grid-cols-[300px_1fr] sm:p-8">
        {/* Radar / camera */}
        <div className="relative mx-auto grid h-[300px] w-[300px] place-items-center">
          <AnimatePresence mode="wait">
            {step === "camera" || step === "sending" ? (
              <motion.div key="cam" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative h-[300px] w-[300px]">
                <Viewfinder />
                <div className="absolute inset-[22px] overflow-hidden rounded-2xl bg-black">
                  {shot ? <img src={shot} alt="Your selfie" className="h-full w-full object-cover" /> : <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />}
                </div>
                {step === "sending" && <div className="absolute inset-[22px] grid place-items-center rounded-2xl bg-black/60"><RefreshCcw className="h-7 w-7 animate-spin text-text" /></div>}
                {!shot && step === "camera" && <div className="pointer-events-none absolute inset-x-[22px] top-[22px] h-1/2 animate-scan bg-gradient-to-b from-transparent to-sindoor/20" />}
              </motion.div>
            ) : step === "success" ? (
              <motion.div key="ok" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="relative grid h-[300px] w-[300px] place-items-center">
                {[0, 1, 2].map((i) => <motion.span key={i} className="absolute h-40 w-40 rounded-full border border-leaf/60" initial={{ scale: 0.4, opacity: 0.8 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 1.6, delay: i * 0.3, repeat: 1 }} />)}
                <div className="absolute grid place-items-center text-center">
                  <CheckCircle2 className="h-14 w-14 text-leaf" />
                  <div className="mt-2 text-[15px] font-semibold">{state === "OUT" ? "Checked in. Have a great shift." : "Checked out. See you tomorrow."}</div>
                  <div className="font-mono text-[12px] text-muted">{fmtTime(new Date())} IST · verified</div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="radar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative h-[300px] w-[300px]">
                <svg viewBox="-150 -150 300 300" className="absolute inset-0">
                  {[1, 0.75, 0.5, 0.25].map((k) => <circle key={k} r={R * k} fill="none" stroke="rgb(var(--line) / 0.12)" strokeDasharray={k === 1 ? undefined : "2 5"} />)}
                  {Array.from({ length: 36 }, (_, i) => <line key={i} x1={0} y1={-R} x2={0} y2={-R + (i % 3 === 0 ? 8 : 4)} stroke="rgb(var(--line) / 0.25)" transform={`rotate(${i * 10})`} />)}
                  <line x1={-R} x2={R} y1={0} y2={0} stroke="rgb(var(--line) / 0.08)" />
                  <line y1={-R} y2={R} x1={0} x2={0} stroke="rgb(var(--line) / 0.08)" />
                  <circle r={fenceR} fill={inside ? "rgb(var(--leaf) / 0.12)" : "rgb(var(--sindoor) / 0.08)"} stroke={inside ? "rgb(var(--leaf))" : "rgb(var(--sindoor))"} strokeWidth="1.5" />
                  <g className="animate-spinslow" style={{ animationDuration: "4s", transformOrigin: "0px 0px", transformBox: "view-box" }}>
                    <path d={`M0 0 L0 ${-R} A${R} ${R} 0 0 1 ${R * Math.sin(0.6)} ${-R * Math.cos(0.6)} Z`} fill="url(#sweep)" />
                  </g>
                  <defs>
                    <linearGradient id="sweep" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="rgb(var(--leaf))" stopOpacity="0" /><stop offset="100%" stopColor="rgb(var(--leaf))" stopOpacity="0.25" /></linearGradient>
                  </defs>
                  <text y={-fenceR - 6} textAnchor="middle" fontSize="9" fill="rgb(var(--muted))">{fence.radiusM} m</text>
                </svg>
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-text bg-bg" title="Warehouse" />
                {dot && (
                  <motion.div className="absolute left-1/2 top-1/2" initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: dot.x, y: dot.y, opacity: 1 }} transition={{ type: "spring", damping: 14 }}>
                    <span className={cn("absolute -left-5 -top-5 h-10 w-10 animate-radar rounded-full", inside ? "bg-leaf/50" : "bg-sindoor/50")} />
                    <span className={cn("absolute -left-2 -top-2 h-4 w-4 rounded-full ring-2 ring-white", inside ? "bg-leaf" : "bg-sindoor")} />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status + actions */}
        <div className="flex flex-col justify-center">
          <div className="label">Today</div>
          {me.record?.checkInAt ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[28px]">IN {fmtTime(me.record.checkInAt)}</span>
              <StatusBadge status={me.record.status} />
            </div>
          ) : (
            <div className="mt-1 text-[24px] font-semibold">Not checked in yet</div>
          )}
          {me.record?.checkOutAt && <div className="mt-1 text-sm text-muted">Out at {fmtTime(me.record.checkOutAt)} — see you tomorrow.</div>}

          <div className={cn("mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm", locError ? "border-sindoor/30 bg-sindoor/10" : inside ? "border-leaf/30 bg-leaf/10" : "border-marigold/30 bg-marigold/10")}>
            {locating ? <LocateFixed className="h-5 w-5 animate-pulse text-muted" /> : locError ? <ShieldAlert className="h-5 w-5 text-sindoor" /> : <MapPin className={cn("h-5 w-5", inside ? "text-leaf" : "text-marigold")} />}
            <div className="flex-1">
              {locating ? "Finding you…" : locError ? locError : fix && off ? (
                inside ? <><b>Inside the warehouse fence</b> · {Math.round(off.d)} m from centre (±{Math.round(fix.accuracyM)} m)</> :
                  <><b>{Math.round(off.d) > 1000 ? `${(off.d / 1000).toFixed(1)} km` : `${Math.round(off.d)} m`} away</b> · check-in works within {fence.radiusM} m{fix.accuracyM > fence.radiusM ? ` (GPS ±${Math.round(fix.accuracyM)} m is too imprecise)` : ""}</>
              ) : null}
            </div>
            <button onClick={locate} className="text-muted hover:text-text" aria-label="Refresh location"><RefreshCcw className="h-4 w-4" /></button>
          </div>
          {DEMO && (
            <label className="mt-3 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} className="accent-[rgb(var(--gold))]" />
              <Sparkles className="h-3.5 w-3.5" /> Demo only: simulate being at the warehouse
            </label>
          )}
          {error && <div className="mt-3 rounded-xl bg-sindoor/10 px-3 py-2 text-sm text-sindoor">{error}</div>}

          <div className="mt-6 flex flex-wrap gap-2">
            {state !== "DONE" && step === "idle" && (
              <Button variant="primary" size="lg" disabled={!inside} icon={state === "OUT" ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />} onClick={startCamera}>
                {state === "OUT" ? "Check in with selfie" : "Check out with selfie"}
              </Button>
            )}
            {step === "camera" && !shot && <Button variant="gold" size="lg" icon={<Camera className="h-5 w-5" />} onClick={() => video.current && setShot(capture(video.current))}>Take selfie</Button>}
            {step === "camera" && shot && (
              <>
                <Button variant="primary" size="lg" onClick={submit}>Confirm {state === "OUT" ? "check-in" : "check-out"}</Button>
                <Button size="lg" onClick={() => setShot(null)}>Retake</Button>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-muted/80">Your location is read only when you tap check-in or check-out. Selfies are kept for the period your employer set, then deleted.</p>
        </div>
      </div>
    </Card>
  );
}

function MyTasks() {
  const { data } = useQuery({ queryKey: ["tasks", "mine"], queryFn: () => api.get<Task[]>("/tasks?mine=1") });
  const update = useAction(({ id, status }: { id: string; status: Task["status"] }) => api.patch(`/tasks/${id}/status`, { status }), { success: "Task updated", invalidate: ["tasks"] });
  return (
    <Card title="My tasks" subtitle="Tap to move a task along">
      <div className="space-y-2 p-4">
        {data?.length === 0 && <div className="py-6 text-center text-sm text-muted">No tasks today.</div>}
        {data?.map((t) => (
          <motion.div layout key={t.id} className={cn("flex items-center gap-3 rounded-2xl border border-line/10 bg-bg2/60 p-4", t.status === "DONE" && "opacity-60")}>
            <button onClick={() => update.mutate({ id: t.id, status: t.status === "TODO" ? "IN_PROGRESS" : t.status === "IN_PROGRESS" ? "DONE" : "TODO" })} className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition", t.status === "DONE" ? "border-leaf bg-leaf/15 text-leaf" : t.status === "IN_PROGRESS" ? "border-marigold text-marigold" : "border-line/20")}>
              {t.status === "DONE" ? <CheckCircle2 className="h-5 w-5" /> : t.status === "IN_PROGRESS" ? <RefreshCcw className="h-4 w-4" /> : null}
            </button>
            <div className="flex-1"><div className={cn("font-medium", t.status === "DONE" && "line-through")}>{t.title}</div><div className="text-xs text-muted">Due {fmtDate(t.dueDate)}</div></div>
            <StatusBadge status={t.priority} />
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function MyLeave() {
  const { data } = useQuery({ queryKey: ["leaves"], queryFn: () => api.get<Leave[]>("/leaves") });
  const [f, setF] = useState({ type: "CASUAL", from: todayKey(), to: todayKey(), reason: "" });
  const apply = useAction(() => api.post("/leaves", f), { success: "Leave request sent to your manager", invalidate: ["leaves"], onSuccess: () => setF({ ...f, reason: "" }) });
  return (
    <Card title="Leave" subtitle="Ask for time off — your manager is notified">
      <div className="grid gap-3 p-5 sm:grid-cols-4">
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{LEAVE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}</Select></Field>
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Reason"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Family function" /></Field>
        <div className="sm:col-span-4"><Button variant="gold" loading={apply.isPending} disabled={f.reason.length < 3} onClick={() => apply.mutate(undefined)}>Request leave</Button></div>
      </div>
      <div className="space-y-2 px-5 pb-5">
        {data?.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl bg-panel2/50 px-4 py-2.5 text-sm">
            <span>{fmtDate(l.from)}{l.to !== l.from ? ` – ${fmtDate(l.to)}` : ""} · {l.days} day{l.days > 1 ? "s" : ""} · <span className="text-muted">{l.reason}</span></span>
            <StatusBadge status={l.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Camera viewfinder corners. */
function Viewfinder() {
  const c = "absolute h-7 w-7 border-sindoor";
  return (
    <div className="pointer-events-none absolute inset-0">
      <span className={`${c} left-0 top-0 rounded-tl-xl border-l-2 border-t-2`} />
      <span className={`${c} right-0 top-0 rounded-tr-xl border-r-2 border-t-2`} />
      <span className={`${c} bottom-0 left-0 rounded-bl-xl border-b-2 border-l-2`} />
      <span className={`${c} bottom-0 right-0 rounded-br-xl border-b-2 border-r-2`} />
    </div>
  );
}
