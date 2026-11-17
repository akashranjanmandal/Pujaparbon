import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { CHANNEL_CODES, IMPORTABLE_CHANNELS, bulkOrderStatusSchema, manualOrderSchema, orderStatusSchema, returnSchema, type ChannelCode } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { badRequest } from "../../lib/errors";
import { ctx, handler, pageParams, str } from "../../lib/http";
import * as svc from "./service";
import { parseOrderRows, parseSettlementRows, readRows, sampleCsv } from "./importer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /\.(csv|xlsx)$/i.test(file.originalname)),
});
const channelParam = (v: unknown) => parse(z.object({ channel: z.enum(CHANNEL_CODES) }), { channel: v }).channel as ChannelCode;

export const orderRoutes = Router();

orderRoutes.get("/", requirePermission("orders.view"), handler((req) => {
  const p = pageParams(req.query);
  const from = str(req.query.from), to = str(req.query.to);
  return svc.list(ctx(req).tenantId, {
    ...p, status: str(req.query.status), channel: str(req.query.channel), search: str(req.query.search),
    from: from ? new Date(from) : undefined, to: to ? new Date(`${to}T23:59:59+05:30`) : undefined,
  });
}));
orderRoutes.get("/imports", requirePermission("orders.import"), handler((req) => svc.importHistory(ctx(req).tenantId)));
orderRoutes.get("/reconciliation", requirePermission("orders.import"), handler((req) => svc.reconciliation(ctx(req).tenantId)));
orderRoutes.get("/import/sample/:channel", requirePermission("orders.import"), handler((req, res) => {
  const channel = channelParam(req.params.channel);
  res.type("text/csv").setHeader("Content-Disposition", `attachment; filename="${channel.toLowerCase()}-orders-sample.csv"`);
  res.send(sampleCsv(channel));
}));
orderRoutes.post("/import", requirePermission("orders.import"), upload.single("file"), handler(async (req) => {
  const channel = channelParam(req.body.channel);
  if (!IMPORTABLE_CHANNELS.includes(channel)) throw badRequest("This channel does not use report files");
  if (!req.file) throw badRequest("Attach a .csv or .xlsx report file");
  const rows = await readRows(req.file);
  return svc.importOrders(ctx(req), channel, req.file.originalname, parseOrderRows(rows), rows.length);
}));
orderRoutes.post("/settlements/import", requirePermission("orders.import"), upload.single("file"), handler(async (req) => {
  const channel = channelParam(req.body.channel);
  if (!req.file) throw badRequest("Attach a .csv or .xlsx settlement file");
  const parsed = parseSettlementRows(await readRows(req.file));
  return svc.importSettlements(ctx(req), channel, req.file.originalname, parsed.rows, parsed.issues);
}));
orderRoutes.post("/", requirePermission("orders.import"), handler(async (req, res) => {
  res.status(201);
  return svc.createManual(ctx(req), parse(manualOrderSchema, req.body));
}));
orderRoutes.post("/bulk-status", requirePermission("orders.process"), handler((req) => {
  const { orderIds, status } = parse(bulkOrderStatusSchema, req.body);
  return svc.bulkStatus(ctx(req), orderIds, status);
}));
orderRoutes.get("/:id", requirePermission("orders.view"), handler((req) => svc.get(ctx(req).tenantId, String(req.params.id))));
orderRoutes.patch("/:id/status", requirePermission("orders.process"), handler((req) => {
  const { status, awb } = parse(orderStatusSchema, req.body);
  return svc.setStatus(ctx(req), String(req.params.id), status, awb);
}));

export const returnRoutes = Router();
returnRoutes.get("/", requirePermission("returns.manage"), handler((req) => svc.listReturns(ctx(req).tenantId)));
returnRoutes.post("/", requirePermission("returns.manage"), handler(async (req, res) => {
  res.status(201);
  return svc.createReturn(ctx(req), parse(returnSchema, req.body));
}));
