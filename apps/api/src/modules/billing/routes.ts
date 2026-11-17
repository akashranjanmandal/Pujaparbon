import { Router } from "express";
import { expenseSchema, invoiceSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as svc from "./service";
import { invoicePdf } from "./invoice-pdf";

export const invoiceRoutes = Router();
invoiceRoutes.use(requirePermission("billing.manage"));
invoiceRoutes.get("/", handler((req) => svc.listInvoices(ctx(req).tenantId)));
invoiceRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return svc.createInvoice(ctx(req), parse(invoiceSchema, req.body));
}));
invoiceRoutes.get("/:id", handler((req) => svc.getInvoice(ctx(req).tenantId, String(req.params.id))));
invoiceRoutes.post("/:id/cancel", handler((req) => svc.cancelInvoice(ctx(req), String(req.params.id))));
invoiceRoutes.get("/:id/pdf", handler(async (req, res) => {
  const pdf = await invoicePdf(await svc.getInvoice(ctx(req).tenantId, String(req.params.id)));
  res.type("application/pdf").setHeader("Content-Disposition", 'inline; filename="invoice.pdf"');
  res.send(pdf);
}));

export const expenseRoutes = Router();
expenseRoutes.use(requirePermission("expenses.manage"));
expenseRoutes.get("/", handler((req) => svc.listExpenses(ctx(req).tenantId, str(req.query.month))));
expenseRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return svc.createExpense(ctx(req), parse(expenseSchema, req.body));
}));
expenseRoutes.delete("/:id", handler((req) => svc.deleteExpense(ctx(req), String(req.params.id))));
