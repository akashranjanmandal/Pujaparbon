"use client";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alpana } from "@/components/brand/Alpana";
import { Diya } from "@/components/brand/Diya";
import { Logo } from "@/components/brand/Logo";
import { Shiuli } from "@/components/brand/Shiuli";
import { Button, Input } from "@/components/ui/primitives";
import { homeFor, useAuth } from "@/lib/auth";
import { greeting } from "@/lib/format";

const DEMO = [
  { role: "Owner", email: "owner@pujaparbon.in", bn: "মালিক" },
  { role: "Manager", email: "manager@pujaparbon.in", bn: "ম্যানেজার" },
  { role: "Staff", email: "staff@pujaparbon.in", bn: "কর্মী" },
];

function LoginInner() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const g = greeting();

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user));
  }, [ready, user, router]);
  useEffect(() => {
    if (params.get("expired")) toast.info("Your session ended. Please sign in again.");
  }, [params]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      toast.success(`${g.bn}, ${u.name.split(" ")[0]}!`, { description: "Welcome back to Puja Parbon." });
      router.replace(homeFor(u));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      {/* Cinematic side */}
      <section className="relative hidden overflow-hidden border-r hairline lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--sindoor-deep)/0.55),transparent_65%)]" />
        <Shiuli density={34} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90">
          <Alpana size={720} spin strokeWidth={0.9} />
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Alpana size={300} tone="shiuli" strokeWidth={1.1} delay={0.8} spin />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
        <div className="absolute left-12 top-10"><Logo /></div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 1 }} className="absolute bottom-14 left-12 right-12">
          <div className="font-bangla text-2xl text-gold">ঢাকের তালে, ব্যবসার হালে</div>
          <h2 className="mt-2 max-w-xl font-display text-[44px] font-semibold leading-[1.05] tracking-tight">
            Every saree, every order, every <span className="gold-text italic">diya</span> — in one place.
          </h2>
          <p className="mt-4 max-w-lg text-[15px] text-muted">Flipkart, Amazon, Myntra, Meesho and your own counter, one stock number, one team, one truth.</p>
        </motion.div>
      </section>

      {/* Form side */}
      <section className="relative flex items-center justify-center px-6 py-16">
        <div className="pointer-events-none absolute -right-40 -top-40 opacity-30 lg:hidden"><Alpana size={420} spin /></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative w-full max-w-[400px]">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <div className="flex items-center gap-3">
            <Diya size={40} />
            <div>
              <div className="font-bangla text-lg text-gold">{g.bn}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted">{g.en}</div>
            </div>
          </div>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">Sign in to your warehouse</h1>
          <p className="mt-2 text-sm text-muted">Owners, managers and staff each see only what their role needs.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
            <div className="relative">
              <Input type={show ? "text" : "password"} autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 pr-11" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text" aria-label="Show password">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} className="text-sm text-sindoor">{error}</motion.p>}
            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              Enter <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-dashed border-line/20 p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-muted">
              <span className="uppercase tracking-[0.14em]">Demo logins</span>
              <span>password <code className="text-gold">PujaParbon@2026</code></span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button key={d.role} type="button" onClick={() => { setEmail(d.email); setPassword("PujaParbon@2026"); }} className="rounded-xl border border-line/15 bg-panel/50 px-2 py-2.5 text-center transition hover:border-gold/50 hover:bg-panel2">
                  <div className="font-bangla text-xs text-gold">{d.bn}</div>
                  <div className="text-sm font-semibold">{d.role}</div>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted/70"><ShieldCheck className="h-3.5 w-3.5 text-leaf" /> Argon2id passwords · rotating sessions · role-based access</p>
        </motion.div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
