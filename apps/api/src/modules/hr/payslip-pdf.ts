import { formatINR } from "@pp/shared";
import { footer, letterhead, newDoc, PDF } from "../../lib/pdf";
import type { payslipFor } from "./service";

export async function payslipPdf({ p, e, t }: Awaited<ReturnType<typeof payslipFor>>) {
  const { doc, done } = newDoc();
  const monthName = new Date(`${p.month}-01T00:00:00Z`).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  letterhead(doc, t, "Salary Slip", monthName);
  const kv = (label: string, value: string, x: number, y: number) => {
    doc.fillColor(PDF.muted).font("Helvetica").fontSize(8).text(label, x, y);
    doc.fillColor(PDF.ink).font("Helvetica-Bold").fontSize(10).text(value, x, y + 11);
  };
  kv("Employee", e.name, 40, 110);
  kv("Code", e.code, 220, 110);
  kv("Designation", e.designation, 320, 110);
  kv("Department", e.department, 450, 110);
  const rows: [string, string][] = [
    ["Monthly salary", formatINR(p.basePaise)],
    ["Working days", String(p.workingDays)],
    ["Days present", String(p.presentDays)],
    ["Paid leave", String(p.paidLeaveDays)],
    ["Late marks", `${p.lateCount} (½ day deducted per 3)`],
    ["Payable days", String(p.payableDays)],
    ["Gross earnings", formatINR(p.grossPaise)],
    ["Advance recovered", `- ${formatINR(p.advancePaise)}`],
  ];
  let y = 160;
  for (const [k, v] of rows) {
    doc.fillColor(PDF.muted).font("Helvetica").fontSize(10).text(k, 40, y);
    doc.fillColor(PDF.ink).text(v, 300, y, { width: 255, align: "right" });
    y += 22;
    doc.moveTo(40, y - 6).lineTo(555, y - 6).strokeColor(PDF.rule).lineWidth(0.5).stroke();
  }
  doc.rect(40, y + 4, 515, 40).fill(PDF.tint);
  doc.fillColor(PDF.red).font("Helvetica-Bold").fontSize(13).text("Net pay", 52, y + 17);
  doc.text(formatINR(p.netPaise), 300, y + 17, { width: 243, align: "right" });
  doc.fillColor(PDF.muted).font("Helvetica").fontSize(8).text(`Status: ${p.status === "PAID" ? "Paid" : "Draft"}. This is a computer-generated slip.`, 40, y + 60);
  footer(doc);
  doc.end();
  return done;
}
