"use client";
import { Alpana } from "@/components/brand/Alpana";

/** Shown for modules that are still being built during the live demo build-out. */
export default function Building() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
      <Alpana size={200} spin />
      <div className="mt-6 font-bangla text-lg text-gold">তৈরি হচ্ছে…</div>
      <h1 className="mt-1 font-display text-3xl">This module is being crafted</h1>
      <p className="mt-2 max-w-md text-sm text-muted">The GOBT team is building this screen right now. Refresh in a few minutes to see it.</p>
    </div>
  );
}
