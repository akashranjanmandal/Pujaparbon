"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** The link a QR sticker points at. Scanning with any phone camera opens the item or lot in the app. */
export const qrUrl = (code: string) => `${typeof window === "undefined" ? "" : window.location.origin}/q/${code}`;

export function Qr({ code, size = 160, className }: { code: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(qrUrl(code), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1C202E", light: "#FFFFFF" } }).then(setSvg).catch(() => setSvg(""));
  }, [code]);
  return <div role="img" aria-label={`QR code ${code}`} className={cn("shrink-0 overflow-hidden rounded-xl border border-line/10 bg-white p-1", className)} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", `<svg width="100%" height="100%" `) }} />;
}
