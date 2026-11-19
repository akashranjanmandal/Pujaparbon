"use client";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { ProfitFlow } from "@/components/brand/ProfitFlow";
import { Button, Input, Segmented } from "@/components/ui/primitives";
import { homeFor, useAuth } from "@/lib/auth";

const DEMO = { owner: { email: "owner@pujaparbon.in", hint: "Everything: buys, stock, platforms, profit, team" }, staff: { email: "staff@pujaparbon.in", hint: "Check in and out, look up an item by QR" } };

function LoginInner() {
  const { login, logout, user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [who, setWho] = useState<"owner" | "staff">("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (ready && user) router.replace(params.get("next") || homeFor(user)); }, [ready, user, router, params]);
  useEffect(() => { if (params.get("expired")) toast.info("Your session ended. Please sign in again."); }, [params]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      // The tab is a guide, not a gate: but a wrong tab usually means a wrong account, so say so.
      if ((who === "owner") !== (u.role === "OWNER")) {
        await logout();
        setError(u.role === "OWNER" ? "This is the owner's account. Choose the Owner tab." : "This is an employee account. Choose the Employee tab.");
        return;
      }
      router.replace(params.get("next") || homeFor(u));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <section className="relative m-4 hidden flex-col justify-between overflow-hidden rounded-[32px] bg-primary-tint p-10 lg:flex">
        <Logo />
        <div className="relative">
          <ProfitFlow className="mx-auto h-auto w-full max-w-[640px]" />
          <h2 className="display mt-10 max-w-lg text-[38px] leading-[1.08]">Buy smart. Price right. <span className="text-peach">Know your profit.</span></h2>
          <p className="mt-4 max-w-md text-[17px] text-muted">Record each market trip, see the real cost of every piece, and watch your profit across every platform you sell on.</p>
        </div>
        <div className="text-[14px] text-muted">Pujo Parbon · Seller OS</div>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <h1 className="display text-[40px] leading-tight">Welcome back</h1>
          <p className="mt-2 text-[16px] text-muted">Sign in to continue.</p>

          <Segmented className="mt-7 w-full [&>button]:flex-1 [&>button]:py-2.5 [&>button]:text-[15px]" value={who} onChange={(v) => { setWho(v); setError(""); setEmail(""); setPassword(""); }} options={[{ value: "owner", label: "Owner" }, { value: "staff", label: "Employee" }]} />

          <form onSubmit={submit} className="mt-6 space-y-3">
            <Input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
            <div className="relative">
              <Input type={show ? "text" : "password"} autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 pr-11" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text" aria-label="Show password">{show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button>
            </div>
            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -4, 4, 0] }} className="text-[15px] text-sindoor">{error}</motion.p>}
            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">Sign in <ArrowRight className="h-4 w-4" /></Button>
          </form>

          <div className="mt-8 rounded-2xl border border-dashed border-line/20 p-4">
            <div className="flex items-center justify-between text-[14px]"><b>Demo account</b><span className="text-muted">Password: PujaParbon@2026</span></div>
            <button type="button" onClick={() => { setEmail(DEMO[who].email); setPassword("PujaParbon@2026"); }} className="mt-3 w-full rounded-xl border border-line/10 bg-panel px-4 py-3 text-left shadow-soft transition hover:border-primary">
              <div className="text-[15px] font-semibold">{DEMO[who].email}</div>
              <div className="text-[13.5px] text-muted">{DEMO[who].hint}</div>
            </button>
          </div>
          <p className="mt-7 flex items-center gap-2 text-[14px] text-muted"><Lock className="h-4 w-4" /> Passwords are stored encrypted. Sessions are secure.</p>
        </motion.div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
