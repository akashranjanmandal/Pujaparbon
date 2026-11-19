"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Avatar } from "./ui/primitives";

/** Selfies are behind login, so they are fetched as blobs rather than plain <img src>. */
export function SelfieImg({ id, kind = "in", name, hue, size = 56, has }: { id: string; kind?: "in" | "out"; name: string; hue: number; size?: number; has: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!has) return;
    let u: string | null = null;
    api.blobUrl(`/attendance/${id}/selfie/${kind}`).then((x) => setUrl((u = x))).catch(() => setUrl(null));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [id, kind, has]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={`${name} selfie`} className="rounded-full object-cover ring-2 ring-panel" style={{ width: size, height: size }} /> : <Avatar name={name} hue={hue} size={size} />;
}
