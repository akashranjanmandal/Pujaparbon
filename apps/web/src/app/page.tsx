"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Boxes, Gauge, MapPin, PackageCheck, ScanBarcode, ShieldCheck, Truck } from "lucide-react";
import { CHANNELS } from "@pp/shared";
import { Logo } from "@/components/brand/Logo";
import { Network } from "@/components/brand/Network";

/** Public one-page site (free landing page from the quotation). Contact details are for the client to confirm. */
const CONTACT = { area: "Sarisha, South 24 Parganas, West Bengal", phone: "", email: "" };

const CAPS = [
  { icon: Boxes, t: "Multi-channel inventory", b: "One stock pool serving Flipkart, Amazon, Myntra, Meesho and Ajio, so you never oversell." },
  { icon: ScanBarcode, t: "Barcoded bins", b: "Every unit has a home. Pickers find it in seconds, audits take minutes." },
  { icon: Truck, t: "Same-day dispatch", b: "Orders picked, packed and handed to couriers within the marketplace SLA." },
  { icon: PackageCheck, t: "Returns handled", b: "RTO and customer returns inspected, restocked or written off — transparently." },
  { icon: Gauge, t: "Live reporting", b: "Sellers see stock, orders and settlements in real time. No spreadsheets." },
  { icon: ShieldCheck, t: "GST-ready", b: "Tax invoices, HSN summaries and audit trails for every movement." },
];

export default function Landing() {
  return (
    <main className="relative overflow-hidden">
      <nav className="fixed inset-x-0 top-0 z-30 border-b hairline bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-6 text-[13px] text-muted">
            <a href="#capabilities" className="hidden hover:text-text sm:block">Capabilities</a>
            <a href="#channels" className="hidden hover:text-text sm:block">Channels</a>
            <Link href="/login" className="rounded-lg border border-line/15 px-3 py-1.5 text-text transition hover:border-line/30">Sign in</Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 pt-24 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="label flex items-center gap-2"><span className="h-1.5 w-1.5 animate-dhak rounded-full bg-leaf" />Fulfilment partner · West Bengal</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[60px]">
            Store. Pack. Ship.<br /><span className="text-sindoor">Across every marketplace.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-5 max-w-md text-[16px] leading-relaxed text-muted">
            Puja Parbon runs warehousing and order fulfilment for sellers on India&apos;s largest marketplaces — with a live operating system behind every parcel.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" className="inline-flex h-11 items-center gap-2 rounded-lg bg-sindoor px-5 text-[14px] font-medium text-white shadow-accent">Work with us <ArrowRight className="h-4 w-4" /></a>
            <a href="#capabilities" className="inline-flex h-11 items-center rounded-lg border border-line/15 px-5 text-[14px] font-medium">How it works</a>
          </motion.div>
          <div className="mt-12 grid max-w-md grid-cols-3 divide-x divide-line/10 border-y hairline py-4 font-mono">
            {[["5", "Marketplaces"], ["24h", "Dispatch SLA"], ["100%", "Stock traceability"]].map(([n, l]) => (
              <div key={l} className="px-4 first:pl-0"><div className="text-[22px]">{n}</div><div className="text-[10.5px] uppercase tracking-wider text-muted">{l}</div></div>
            ))}
          </div>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }} className="paar-card p-4">
          <div className="label mb-2 flex justify-between px-1"><span>Live network</span><span>ap-south-1</span></div>
          <Network className="h-auto w-full" />
        </motion.div>
      </section>

      <section id="capabilities" className="border-t hairline">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="label">Capabilities</div>
          <h2 className="mt-3 max-w-xl text-[34px] font-semibold leading-tight tracking-[-0.02em]">Everything between “order placed” and “delivered”.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl2 border hairline bg-line/[0.07] sm:grid-cols-2 lg:grid-cols-3">
            {CAPS.map((c, i) => (
              <motion.div key={c.t} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="bg-bg p-7">
                <c.icon className="h-5 w-5 text-sindoor" />
                <div className="mt-5 text-[15px] font-semibold">{c.t}</div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{c.b}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="channels" className="border-t hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 md:flex-row md:items-center md:justify-between">
          <div><div className="label">Channels</div><h2 className="mt-3 text-[26px] font-semibold tracking-tight">Integrated with the marketplaces you sell on</h2></div>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.filter((c) => !["OFFLINE", "OWN_STORE"].includes(c.code)).map((c) => (
              <span key={c.code} className="flex items-center gap-2 rounded-lg border border-line/10 px-4 py-2.5 text-[14px]"><span className="h-2 w-2 rounded-[3px]" style={{ background: c.color }} />{c.name}</span>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-4 flex items-center gap-2 text-[13px] text-muted"><MapPin className="h-4 w-4" />{CONTACT.area}</p>
            {(CONTACT.phone || CONTACT.email) && <p className="mt-1 text-[13px] text-muted">{[CONTACT.phone, CONTACT.email].filter(Boolean).join(" · ")}</p>}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted/70">© {new Date().getFullYear()} Puja Parbon · Built by GOBT</p>
        </div>
      </footer>
    </main>
  );
}
