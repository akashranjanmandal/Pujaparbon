"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Boxes, CheckCircle2, ChevronDown, LineChart, MapPin, PackageCheck, Phone, Receipt, RotateCcw, ScanBarcode, Truck } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";

/** Public site for people who have never heard of Puja Parbon. Contact details are for the client to fill in. */
const CONTACT = { area: "Sarisha, South 24 Parganas, West Bengal", phone: "", email: "" };
const MARKETS = ["Flipkart", "Amazon", "Myntra", "Meesho", "Ajio", "Your own website"];

const STEPS = [
  { n: "01", t: "Send us your stock", b: "Drop off or ship your products to our warehouse in Sarisha. We count every piece and give you a receipt.", tone: "bg-primary-soft" },
  { n: "02", t: "We shelve and label it", b: "Each item gets a barcode and a rack location, so it can be found in seconds — and never goes missing.", tone: "bg-lav-soft" },
  { n: "03", t: "Orders come in, we ship", b: "When a customer orders on any marketplace, our team picks, packs and hands it to the courier the same day.", tone: "bg-peach-soft" },
  { n: "04", t: "You watch it all live", b: "Your own dashboard shows stock, orders, returns and payments from every marketplace in one place.", tone: "bg-primary-soft" },
];

const BENEFITS = [
  { icon: Boxes, t: "One stock count for every marketplace", b: "Sell the same product on Flipkart, Amazon and Meesho without overselling." },
  { icon: Truck, t: "Same-day packing and dispatch", b: "We meet marketplace dispatch deadlines, so your seller rating stays healthy." },
  { icon: RotateCcw, t: "Returns checked for you", b: "Returned items are inspected. Good ones go back on the shelf; damaged ones are reported." },
  { icon: ScanBarcode, t: "Barcoded racks", b: "Every unit has a home and a scan history. Nothing walks away unnoticed." },
  { icon: Receipt, t: "GST invoices and reports", b: "Tax invoices, stock reports and monthly summaries ready for your accountant." },
  { icon: LineChart, t: "Payment tracking", b: "We match what each marketplace paid you against what it owed, and flag shortfalls." },
];

const FAQ = [
  { q: "What exactly is Puja Parbon?", a: "We are a warehousing and order-fulfilment company. Online sellers keep their products with us; when an order comes in on any marketplace, we pack and ship it for them." },
  { q: "Do I need to stop selling on my current marketplaces?", a: "No. You keep your own seller accounts on Flipkart, Amazon, Myntra, Meesho and others. We simply handle the physical side — storage, packing, dispatch and returns." },
  { q: "How will I know what is happening with my stock?", a: "You get a login to our Seller OS dashboard. It shows live stock, every order and its status, returns, and marketplace payments — on your phone or computer." },
  { q: "What kind of products can you handle?", a: "Most non-perishable goods sold online: clothing, footwear, home and kitchen, electronics accessories, beauty and more. Talk to us about anything unusual." },
  { q: "How do I get started?", a: "Contact us, tell us what you sell and roughly how many orders you get. We will visit or call, agree a simple plan, and you can start sending stock." },
];

function Collage() {
  return (
    <div className="relative mx-auto aspect-[5/5] w-full max-w-[520px]">
      <motion.div initial={{ opacity: 0, y: 30, rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: -6 }} transition={{ delay: 0.2, duration: 0.7 }} className="absolute left-[2%] top-[4%] z-10 w-[60%] rounded-[26px] bg-primary-soft p-6 shadow-lift">
        <div className="text-[14px] font-semibold text-primary">New order · Flipkart</div>
        <div className="display mt-2 text-[28px] leading-tight">Cotton Kurta, M</div>
        <div className="mt-4 flex items-center justify-between text-[15px]"><span className="text-text/70">Ship to Bengaluru</span><span className="font-semibold">₹899</span></div>
        <div className="mt-4 h-2 rounded-full bg-white/60"><motion.div className="h-full rounded-full bg-primary" initial={{ width: "10%" }} animate={{ width: "72%" }} transition={{ delay: 1, duration: 1.6 }} /></div>
        <div className="mt-2 text-[13.5px] text-text/60">Picked · Packed · <b className="text-text">Shipping today</b></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 30, rotate: 5 }} animate={{ opacity: 1, y: 0, rotate: 5 }} transition={{ delay: 0.4, duration: 0.7 }} className="absolute right-[2%] top-[40%] w-[50%] rounded-[26px] bg-lav-soft p-6 shadow-lift">
        <div className="text-[14px] font-semibold text-lav">Your stock right now</div>
        <div className="display mt-2 text-[52px] leading-none">1,838</div>
        <div className="text-[15px] text-text/70">units across 30 products</div>
        <div className="mt-4 grid grid-cols-6 gap-1">
          {Array.from({ length: 18 }, (_, i) => <span key={i} className="aspect-square rounded-[5px]" style={{ background: `rgb(var(--lav) / ${0.15 + ((i * 37) % 10) / 14})` }} />)}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 30, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ delay: 0.6, duration: 0.7 }} className="absolute bottom-[2%] left-[6%] z-20 w-[56%] rounded-[26px] bg-peach-soft p-5 shadow-lift">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-peach"><CheckCircle2 className="h-6 w-6" /></span>
          <div><div className="text-[16px] font-semibold">Handed to courier</div><div className="text-[14.5px] text-text/70">Amazon order · 4:12 pm</div></div>
        </div>
      </motion.div>
      <svg viewBox="0 0 120 120" className="absolute right-[8%] top-[6%] w-[22%] animate-float" aria-hidden>
        <path d="M60 18 L104 40 L60 62 L16 40 Z" fill="rgb(var(--peach-soft))" stroke="rgb(var(--text))" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 40 V82 L60 104 V62 Z" fill="rgb(var(--primary-soft))" stroke="rgb(var(--text))" strokeWidth="2" strokeLinejoin="round" />
        <path d="M104 40 V82 L60 104 V62 Z" fill="rgb(var(--lav-soft))" stroke="rgb(var(--text))" strokeWidth="2" strokeLinejoin="round" />
        <path d="M38 29 L82 51 V64" fill="none" stroke="rgb(var(--text))" strokeWidth="2" />
      </svg>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="rounded-[30px] border border-line/[0.08] bg-panel p-3 shadow-lift sm:p-4">
      <div className="flex items-center gap-1.5 px-2 pb-3"><span className="h-3 w-3 rounded-full bg-peach-soft" /><span className="h-3 w-3 rounded-full bg-lav-soft" /><span className="h-3 w-3 rounded-full bg-primary-soft" /><span className="ml-3 text-[14px] text-muted">sellers.pujaparbon.in</span></div>
      <div className="grid gap-3 rounded-[22px] bg-bg p-4 sm:grid-cols-3 sm:p-5">
        <div className="rounded-2xl bg-primary-soft p-5 sm:col-span-2"><div className="text-[14px] font-semibold text-primary">Today&apos;s sales</div><div className="display mt-2 text-[48px] leading-none">₹42,380</div><div className="mt-2 text-[15px] text-text/70">36 orders · ↑ 12% vs yesterday</div></div>
        <div className="rounded-2xl bg-peach-soft p-5"><div className="text-[14px] font-semibold text-peach">Needs you</div><div className="display mt-2 text-[48px] leading-none">2</div><div className="mt-2 text-[15px] text-text/70">items running low</div></div>
        <div className="rounded-2xl bg-panel p-5 sm:col-span-3">
          <div className="mb-3 text-[15px] font-semibold">Orders by marketplace</div>
          {[["Flipkart", 74, "#2874F0"], ["Amazon", 58, "#FF9900"], ["Meesho", 41, "#9F2089"], ["Myntra", 22, "#FF3F6C"]].map(([n, v, c]) => (
            <div key={n as string} className="mb-2 flex items-center gap-3 text-[15px]"><span className="w-20">{n}</span><span className="h-2.5 flex-1 rounded-full bg-bg2"><motion.span className="block h-full rounded-full" style={{ background: c as string }} initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} transition={{ duration: 1 }} /></span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <main className="overflow-hidden">
      <nav className="sticky top-0 z-30 border-b hairline bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5"><LogoMark /><span className="text-[17px] font-semibold tracking-tight">Puja Parbon</span></Link>
          <div className="hidden items-center gap-7 text-[16px] text-muted md:flex">
            <a href="#what" className="hover:text-text">What we do</a><a href="#how" className="hover:text-text">How it works</a><a href="#faq" className="hover:text-text">Questions</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-xl px-3.5 py-2 text-[16px] font-semibold text-text hover:bg-bg2 sm:block">Seller login</Link>
            <a href="#contact" className="rounded-xl bg-text px-4 py-2 text-[16px] font-semibold text-white">Talk to us</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2 rounded-full bg-lav-tint px-3.5 py-1.5 text-[15px] font-semibold text-lav"><MapPin className="h-4 w-4" />Warehousing &amp; order fulfilment · West Bengal</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="display mt-6 text-[42px] leading-[1.04] sm:text-[58px]">
            You sell online.<br /><em className="text-primary">We handle everything</em> after the order.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-6 max-w-lg text-[18px] leading-relaxed text-text/75">
            Puja Parbon stores your products, packs every order and ships it on time — for Flipkart, Amazon, Myntra, Meesho and more. You focus on selling; we take care of the warehouse.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[16px] font-semibold text-white shadow-accent">Start with Puja Parbon <ArrowRight className="h-4 w-4" /></a>
            <a href="#how" className="inline-flex h-12 items-center rounded-xl border border-line/15 bg-panel px-6 text-[16px] font-semibold">See how it works</a>
          </motion.div>
        </div>
        <Collage />
      </section>

      {/* Marketplace band */}
      <section className="border-y border-lav/15 bg-lav-tint py-5">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[...MARKETS, ...MARKETS, ...MARKETS, ...MARKETS].map((m, i) => <span key={i} className="display text-[26px] text-lav/80">{m} <span className="text-peach">✦</span></span>)}
        </div>
      </section>

      {/* What */}
      <section id="what" className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="eyebrow">What is Puja Parbon?</div>
            <h2 className="display mt-3 text-[34px] leading-[1.12] sm:text-[40px]">Your warehouse, packing team and shipping desk — <em className="text-peach">without building one.</em></h2>
          </div>
          <div className="space-y-5 text-[17px] leading-relaxed text-text/75 lg:pt-10">
            <p>Selling online is the easy part. Keeping stock organised, packing dozens of parcels a day, meeting each marketplace&apos;s dispatch deadline and chasing returns is what eats a seller&apos;s time.</p>
            <p>Puja Parbon does that work for you from our warehouse in Sarisha, near Kolkata. Your products sit on our barcoded racks, our trained team packs and ships every order, and you see all of it live from your phone.</p>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-panel py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="eyebrow">How it works</div>
          <h2 className="display mt-3 max-w-2xl text-[34px] leading-[1.12] sm:text-[40px]">Four simple steps, and you never pack a parcel again.</h2>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: i * 0.1 }} className={`${s.tone} flex flex-col rounded-[26px] p-7`}>
                <span className="display text-[64px] leading-none text-text/25">{s.n}</span>
                <div className="mt-8 text-[20px] font-semibold leading-snug">{s.t}</div>
                <p className="mt-2 text-[16.5px] leading-relaxed text-text/75">{s.b}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="eyebrow">What you get</div>
        <h2 className="display mt-3 max-w-2xl text-[34px] leading-[1.12] sm:text-[40px]">Everything a growing seller needs behind the scenes.</h2>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <motion.div key={b.t} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: i * 0.06 }}>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${["bg-primary-tint text-primary", "bg-lav-tint text-lav", "bg-peach-tint text-peach"][i % 3]}`}><b.icon className="h-6 w-6" /></span>
              <div className="mt-4 text-[18px] font-semibold">{b.t}</div>
              <p className="mt-1.5 text-[16.5px] leading-relaxed text-muted">{b.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="bg-primary-tint py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <div className="eyebrow">Your seller dashboard</div>
            <h2 className="display mt-3 text-[34px] leading-[1.12] sm:text-[40px]">Know exactly where every product is. Any time.</h2>
            <ul className="mt-6 space-y-3 text-[16.5px] text-text/80">
              {["Live stock for every product and size", "Every order from every marketplace, with its status", "Returns, payments and GST invoices in one place", "Works on your phone — no app to install"].map((t) => (
                <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />{t}</li>
              ))}
            </ul>
          </div>
          <DashboardPreview />
        </div>
      </section>

      {/* Who */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="eyebrow">Who it is for</div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Just starting out", "You have a great product and a marketplace account, but no space or staff to pack orders.", "bg-peach-tint"],
            ["Growing fast", "Orders doubled and your home or shop is full of boxes. You need a team that scales with you.", "bg-lav-tint"],
            ["On many marketplaces", "You sell on three or more platforms and keeping stock in sync is a daily headache.", "bg-primary-tint"],
          ].map(([t, b, c]) => (
            <div key={t} className={`${c} rounded-[26px] p-8`}>
              <PackageCheck className="h-7 w-7 text-text/70" />
              <div className="display mt-6 text-[26px] leading-tight">{t}</div>
              <p className="mt-2 text-[16.5px] leading-relaxed text-text/75">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-panel py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="eyebrow">Questions</div>
            <h2 className="display mt-3 text-[34px] leading-[1.12] sm:text-[40px]">Things people ask us first.</h2>
          </div>
          <div className="divide-y divide-line/10 border-y hairline">
            {FAQ.map((f, i) => (
              <div key={f.q}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[18px] font-semibold">
                  {f.q}<ChevronDown className={`h-5 w-5 shrink-0 text-muted transition ${open === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-5 text-[16px] leading-relaxed text-text/75">{f.a}</motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="mx-auto max-w-6xl px-5 py-20">
        <div className="relative overflow-hidden rounded-[36px] bg-primary px-8 py-16 text-white sm:px-14">
          <svg viewBox="0 0 200 200" className="absolute -right-20 -top-20 w-[380px] text-white/10" aria-hidden>{[90, 70, 50, 30].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="12" />)}</svg>
          <div className="relative max-w-2xl">
            <h2 className="display text-[36px] leading-[1.08] sm:text-[48px]">Ready to stop packing parcels at midnight?</h2>
            <p className="mt-4 text-[18px] text-white/80">Tell us what you sell and how many orders you get. We&apos;ll reply with a simple plan.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={CONTACT.phone ? `tel:${CONTACT.phone}` : "#contact"} className="inline-flex h-12 items-center gap-2 rounded-xl bg-peach-soft px-6 text-[16px] font-semibold text-text"><Phone className="h-4 w-4" />{CONTACT.phone || "Call us"}</a>
              <Link href="/login" className="inline-flex h-12 items-center rounded-xl border border-white/30 px-6 text-[16px] font-semibold">Already a seller? Log in</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-[15.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><LogoMark size={28} /><span className="font-semibold text-text">Puja Parbon</span> · {CONTACT.area}</div>
          <div>© {new Date().getFullYear()} Puja Parbon · Website by GOBT</div>
        </div>
      </footer>
    </main>
  );
}
