"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertOctagon, CheckCircle2, Hourglass, Upload, Wallet } from "lucide-react";
import { CHANNELS, IMPORTABLE_CHANNELS } from "@pp/shared";
import { Drawer } from "@/components/ui/Drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { Table } from "@/components/ui/Table";
import { Button, Card, ChannelDot, Field, Segmented, Select, StatusBadge } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { compactINR, fmtDate, formatINR } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface Rec { id: string; channelOrderId: string; channelName: string; channelColor: string; orderedAt: string; totalPaise: number; feesPaise: number; settledPaise: number | null; expectedPaise: number; gapPaise: number | null; state: string }

export default function ReconciliationPage() {
  const [filter, setFilter] = useState<"ALL" | "SHORT" | "PENDING" | "MATCHED">("SHORT");
  const [upload, setUpload] = useState(false);
  const { data } = useQuery({ queryKey: ["orders", "reconciliation"], queryFn: () => api.get<{ items: Rec[]; summary: Record<string, number> }>("/orders/reconciliation") });
  const rows = data?.items.filter((i) => filter === "ALL" || i.state === filter);
  const s = data?.summary;
  return (
    <div>
      <PageHeader title="Settlements" subtitle="Did each marketplace pay what it owed? Upload the payout report and short payments light up."
        actions={<Button variant="primary" icon={<Upload className="h-4 w-4" />} onClick={() => setUpload(true)}>Upload settlement file</Button>} />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Received from marketplaces" value={s.settledPaise} format={compactINR} icon={<Wallet className="h-5 w-5" />} tone="green" />
          <Stat label="Paid in full" value={s.matched} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" delay={0.05} onClick={() => setFilter("MATCHED")} />
          <Stat label="Awaiting payout" value={s.pending} icon={<Hourglass className="h-5 w-5" />} tone="blue" hint={compactINR(s.pendingPaise)} delay={0.1} onClick={() => setFilter("PENDING")} />
          <Stat label="Short-paid" value={s.short} icon={<AlertOctagon className="h-5 w-5" />} tone="red" hint={`${formatINR(s.shortPaise, { decimals: false })} to claim`} delay={0.15} onClick={() => setFilter("SHORT")} />
        </div>
      )}
      <Card plain className="overflow-hidden" title="Order-level payouts" action={<Segmented value={filter} onChange={setFilter} options={[{ value: "SHORT", label: "Short" }, { value: "PENDING", label: "Pending" }, { value: "MATCHED", label: "Matched" }, { value: "ALL", label: "All" }]} />}>
        <Table rows={rows} loading={!data} columns={[
          { key: "o", header: "Order", cell: (r) => <div><code className="text-xs font-semibold">{r.channelOrderId}</code><div className="text-xs text-muted">{fmtDate(r.orderedAt)}</div></div> },
          { key: "c", header: "Channel", cell: (r) => <ChannelDot color={r.channelColor} name={r.channelName} /> },
          { key: "t", header: "Order value", align: "right", cell: (r) => <span className="num">{formatINR(r.totalPaise, { decimals: false })}</span> },
          { key: "f", header: "Fees", align: "right", cell: (r) => <span className="text-muted num">{r.feesPaise ? `−${formatINR(r.feesPaise, { decimals: false })}` : "—"}</span> },
          { key: "e", header: "Expected", align: "right", cell: (r) => <span className="num">{formatINR(r.expectedPaise, { decimals: false })}</span> },
          { key: "s", header: "Received", align: "right", cell: (r) => <b className="num">{r.settledPaise != null ? formatINR(r.settledPaise, { decimals: false }) : "—"}</b> },
          { key: "g", header: "Gap", align: "right", cell: (r) => r.gapPaise && r.gapPaise > 100 ? <b className="text-sindoor num">−{formatINR(r.gapPaise, { decimals: false })}</b> : <span className="text-muted">—</span> },
          { key: "st", header: "", cell: (r) => <StatusBadge status={r.state} /> },
        ]} />
      </Card>
      {upload && <UploadDrawer onClose={() => setUpload(false)} />}
    </div>
  );
}

function UploadDrawer({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState("FLIPKART");
  const [file, setFile] = useState<File | null>(null);
  const run = useAction(() => { const f = new FormData(); f.append("channel", channel); f.append("file", file!); return api.upload<{ matched: number; notFound: string[] }>("/orders/settlements/import", f); }, {
    success: (r) => `${r.matched} orders matched${r.notFound.length ? ` · ${r.notFound.length} not found` : ""}`, invalidate: ["orders"], onSuccess: onClose,
  });
  return (
    <Drawer open onClose={onClose} title="Upload a settlement report" subtitle="Needs an Order ID column and a Settlement Amount column. A fee column is optional."
      footer={<Button variant="primary" disabled={!file} loading={run.isPending} onClick={() => run.mutate(undefined)}>Reconcile</Button>}>
      <div className="space-y-4">
        <Field label="Marketplace"><Select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.filter((c) => IMPORTABLE_CHANNELS.includes(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select></Field>
        <Field label="File (.csv or .xlsx)"><input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted file:mr-4 file:rounded-xl file:border-0 file:bg-gold/15 file:px-4 file:py-2 file:text-gold" /></Field>
      </div>
    </Drawer>
  );
}
