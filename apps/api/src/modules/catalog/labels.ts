import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatINR } from "@pp/shared";

export interface QrLabel { code: string; title: string; subtitle?: string; price?: number }

/** A4 sheet of QR stickers, 3 x 8 (63.5 x 33.9 mm). The QR holds a link: scanning it opens the item or lot in the app. */
export async function labelSheetPdf(labels: QrLabel[], baseUrl: string, business: string): Promise<Buffer> {
  const mm = (n: number) => (n * 72) / 25.4;
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  const cols = 3, rows = 8, w = mm(63.5), h = mm(33.9), left = mm(7.2), top0 = mm(13);
  for (let i = 0; i < labels.length; i++) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) doc.addPage();
    const x = left + (slot % cols) * (w + mm(2.5));
    const y = top0 + Math.floor(slot / cols) * h;
    const l = labels[i];
    const png = await QRCode.toBuffer(`${baseUrl.replace(/\/$/, "")}/q/${l.code}`, { margin: 0, width: 220, errorCorrectionLevel: "M" });
    const q = mm(25);
    doc.image(png, x + 6, y + (h - q) / 2, { width: q, height: q });
    const tx = x + 6 + q + 8, tw = w - q - 22;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#2E688C").text(business.toUpperCase(), tx, y + 10, { width: tw, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1C202E").text(l.title, tx, y + 21, { width: tw, height: 24, ellipsis: true });
    if (l.subtitle) doc.font("Helvetica").fontSize(7).fillColor("#606678").text(l.subtitle, tx, doc.y + 1, { width: tw, height: 18, ellipsis: true });
    if (l.price) doc.font("Helvetica-Bold").fontSize(11).fillColor("#D2643E").text(formatINR(l.price, { decimals: false }), tx, y + h - 24, { width: tw, lineBreak: false });
    doc.font("Courier").fontSize(7).fillColor("#606678").text(l.code, tx, y + h - 12, { width: tw, lineBreak: false });
  }
  if (!labels.length) doc.text("No labels");
  doc.end();
  return done;
}
