"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ScanLine } from "lucide-react";
import { Loader } from "@/components/ui/Loader";
import { ProductGlyph } from "@/components/ui/ProductGlyph";
import { Button, Card } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

interface Res {
  type: "PRODUCT" | "LOT"; money: boolean;
  product?: { id: string; name: string; category: string; unit: string; onHand: number; lastCountAt: number | null };
  trip?: { id: string };
}

/** Where a scanned sticker lands. The owner jumps straight to the full page; an employee sees only the name and how many are in stock. */
export default function ScanResult() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data, error } = useQuery({ queryKey: ["lookup", code], queryFn: () => api.get<Res>(`/lookup/${code}`), retry: false });
  useEffect(() => {
    if (!data?.money) return;
    router.replace(data.type === "PRODUCT" ? `/products/${data.product!.id}` : `/buy/${data.trip!.id}`);
  }, [data, router]);

  if (error) return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="display text-[32px]">Not found</div>
      <p className="mt-2 text-[16px] text-muted">We could not find <code className="font-semibold">{code}</code>. The sticker may be from another business, or the item was removed.</p>
      <Link href="/scan"><Button variant="primary" className="mt-6" icon={<ScanLine className="h-4 w-4" />}>Scan another</Button></Link>
    </div>
  );
  if (!data || data.money) return <Loader label="Opening" />;
  const p = data.product!;
  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <div className="p-8 text-center">
          <ProductGlyph name={p.name} size={72} className="mx-auto rounded-2xl" />
          <div className="mt-5 text-[14px] font-semibold text-primary">{p.category}</div>
          <h1 className="display mt-1 text-[30px] leading-tight">{p.name}</h1>
          <div className="mt-6 rounded-2xl bg-primary-soft p-6">
            <div className="text-[14px] font-semibold text-primary">In stock</div>
            <div className="display text-[56px] leading-none">{p.onHand.toLocaleString("en-IN")}</div>
            <div className="text-[15px] text-text/70">{p.unit}</div>
          </div>
          <p className="mt-4 text-[14px] text-muted">{p.lastCountAt ? `Last counted ${fmtDateTime(p.lastCountAt)}` : "Not counted yet"}</p>
          <Link href="/scan"><Button className="mt-6" icon={<ScanLine className="h-4 w-4" />}>Scan another</Button></Link>
        </div>
      </Card>
    </div>
  );
}
