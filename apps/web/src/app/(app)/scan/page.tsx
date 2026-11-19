"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Card, Input } from "@/components/ui/primitives";
import { extractCode } from "@/lib/scan";


export default function ScanPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [cam, setCam] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const go = (t: string) => {
    const code = extractCode(t);
    if (!code) return setError("That does not look like one of our QR codes.");
    router.push(`/q/${code}`);
  };

  useEffect(() => {
    if (!cam) return;
    let stop = false;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (stop || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          const code = found[0]?.rawValue ? extractCode(found[0].rawValue) : null;
          if (code) return router.push(`/q/${code}`);
          setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError("Camera is not available. Use your phone's camera app to scan, or type the code.");
        setCam(false);
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [cam, router]);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Scan a QR code" subtitle="Scan an item or a lot sticker to see its stock and details." />
      <Card>
        <div className="space-y-5 p-6">
          {cam && <div className="overflow-hidden rounded-2xl bg-black"><video ref={video} playsInline muted className="aspect-square w-full object-cover" /></div>}
          <form onSubmit={(e) => { e.preventDefault(); go(text); }} className="space-y-3">
            <label className="block text-[15px] font-semibold">Scan with a barcode scanner, or type the code</label>
            <Input autoFocus value={text} onChange={(e) => { setText(e.target.value); setError(""); }} placeholder="Click here, then scan" className="h-14 text-[18px]" />
            {error && <p className="text-[14.5px] text-sindoor">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" icon={<ScanLine className="h-4 w-4" />} disabled={!text}>Look up</Button>
              {supported && !cam && <Button type="button" icon={<Camera className="h-4 w-4" />} onClick={() => setCam(true)}>Use the camera</Button>}
            </div>
          </form>
          <p className="text-[14px] text-muted">On a phone, you can also open the normal camera app and point it at the sticker: it opens the right page by itself.</p>
        </div>
      </Card>
    </div>
  );
}
