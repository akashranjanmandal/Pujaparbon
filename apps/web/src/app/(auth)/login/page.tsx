"use client";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Network } from "@/components/brand/Network";
import { Button, Input } from "@/components/ui/primitives";
import { homeFor, useAuth } from "@/lib/auth";

const DEMO = [
  { role: "Owner", email: "owner@pujaparbon.in", desc: "Everything" },
  { role: "Manager", email: "manager@pujaparbon.in", desc: "Operations" },
  { role: "Staff", email: "staff@pujaparbon.in", desc: "Shift & tasks" },
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

  useEffect(() => { if (ready && user) router.replace(homeFor(user)); }, [ready, user, router]);
  useEffect(() => { if (params.get("expired")) toast.info("Session ended. Please sign in again."); }, [params]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(email, password);
      router.replace(homeFor(u));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.2fr_1fr]">
      <section className="relative m-4 hidden flex-col justify-between overflow-hidden rounded-[32px] bg-primary-tint p-10 lg:flex">
        <Logo />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6">
          <Network className="mx-auto h-auto w-full max-w-[640px]" />
        </motion.div>
        <div className="relative">
          <h2 className="display max-w-lg text-[36px] leading-[1.1]">
            Every marketplace. One warehouse. <span className="text-peach">Zero paperwork.</span>
          </h2>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-muted">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-leaf shadow-[0_0_6px_rgb(var(--leaf))]" />All systems normal</span>
            <span>5 channels connected</span>
            <span>Region ap-south-1</span>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-[380px]">
          <div className="mb-12 lg:hidden"><Logo /></div>
          <div className="eyebrow">Seller OS</div>
          <h1 className="display mt-2 text-[38px]">Welcome back</h1>
          <p className="mt-1.5 text-[16px] text-muted">Sign in to manage your warehouse. Each role sees only what it needs.</p>

          <form onSubmit={submit} className="mt-8 space-y-3">
            <Input type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
            <div className="relative">
              <Input type={show ? "text" : "password"} autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 pr-10" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text" aria-label="Show password">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -4, 4, 0] }} className="text-[14px] text-sindoor">{error}</motion.p>}
            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">Continue <ArrowRight className="h-4 w-4" /></Button>
          </form>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-[15px] text-muted"><span className="font-semibold text-text">Demo access</span><span>Password: PujaParbon@2026</span></div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button key={d.role} type="button" onClick={() => { setEmail(d.email); setPassword("PujaParbon@2026"); }} className="rounded-xl border border-line/10 bg-panel px-3.5 py-3 text-left shadow-soft transition hover:border-primary">
                  <div className="text-[14px] font-medium">{d.role}</div>
                  <div className="text-[13.5px] text-muted">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-8 flex items-center gap-2 text-[15px] text-muted"><Lock className="h-4 w-4" /> Encrypted passwords and secure sessions</p>
        </motion.div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
