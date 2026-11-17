import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";
import { formatINR } from "@pp/shared";

interface Label { sku: string; name: string; size: string | null; color: string | null; mrpPaise: number }

/** A4 sheet, 3 x 8 labels (63.5 x 33.9 mm), Code 128 barcodes generated locally. */
export async function labelSheetPdf(labels: Label[], copies: number): Promise<Buffer> {
  const mm = (n: number) => (n * 72) / 25.4;
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));

  const all = labels.flatMap((l) => Array.from({ length: copies }, () => l));
  const cols = 3, rows = 8, w = mm(63.5), h = mm(33.9), left = mm(7.2), top0 = mm(13);
  for (let i = 0; i < all.length; i++) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const x = left + (slot % cols) * (w + mm(2.5));
    const y = top0 + Math.floor(slot / cols) * h;
    const l = all[i];
    const png = await bwipjs.toBuffer({ bcid: "code128", text: l.sku, scale: 2, height: 9, includetext: false });
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#7A0F1F").text("PUJA PARBON", x + 6, y + 5, { width: w - 12 });
    doc.font("Helvetica").fontSize(7).fillColor("#222").text(l.name, x + 6, y + 14, { width: w - 12, height: 9, ellipsis: true });
    doc.image(png, x + 6, y + 25, { width: w - 12, height: mm(11) });
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#000").text(l.sku, x + 6, y + 25 + mm(11) + 2, { width: (w - 12) / 2 });
    const meta = [l.size, l.color].filter(Boolean).join(" · ");
    doc.font("Helvetica").fontSize(7).text(`MRP ${formatINR(l.mrpPaise, { decimals: false })}${meta ? `  ${meta}` : ""}`, x + 6 + (w - 12) / 2, y + 25 + mm(11) + 2, { width: (w - 12) / 2, align: "right" });
  }
  doc.end();
  return done;
}
