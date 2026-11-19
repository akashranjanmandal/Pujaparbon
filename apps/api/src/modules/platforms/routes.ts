import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { aliasSchema, platformSchema, reportUploadSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { badRequest } from "../../lib/errors";
import { ctx, handler } from "../../lib/http";
import * as svc from "./service";
import { SAMPLE_CSV } from "./importer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /\.(csv|xlsx|pdf|png|jpe?g)$/i.test(file.originalname)),
});

export const platformRoutes = Router();
platformRoutes.use(requirePermission("platforms.manage"));

platformRoutes.get("/", handler((req) => svc.list(ctx(req).tenantId)));
platformRoutes.get("/sample.csv", handler((_req, res) => {
  res.type("text/csv").setHeader("Content-Disposition", 'attachment; filename="sales-report-template.csv"');
  res.send(SAMPLE_CSV);
}));
platformRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return svc.create(ctx(req), parse(platformSchema, req.body));
}));
platformRoutes.get("/reports/:reportId/file", handler(async (req, res) => {
  const r = await svc.fileOf(ctx(req).tenantId, String(req.params.reportId));
  res.type(r.mime).setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(r.fileName)}"`);
  res.send(r.data);
}));
platformRoutes.delete("/reports/:reportId", handler((req) => svc.removeReport(ctx(req), String(req.params.reportId))));

platformRoutes.get("/:id", handler((req) => svc.tracker(ctx(req).tenantId, String(req.params.id))));
platformRoutes.patch("/:id", handler((req) => svc.update(ctx(req), String(req.params.id), parse(platformSchema.partial().extend({ resetMapping: z.boolean().optional() }), req.body))));
platformRoutes.delete("/:id", handler((req) => svc.remove(ctx(req), String(req.params.id))));
platformRoutes.get("/:id/unmatched", handler((req) => svc.unmatched(ctx(req).tenantId, String(req.params.id))));
platformRoutes.post("/:id/aliases", handler((req) => {
  const { alias, productId } = parse(aliasSchema, req.body);
  return svc.mapAlias(ctx(req), String(req.params.id), alias, productId);
}));
platformRoutes.post("/:id/preview", upload.single("file"), handler(async (req) => {
  if (!req.file) throw badRequest("Attach a .csv or .xlsx file");
  return svc.preview(ctx(req).tenantId, String(req.params.id), req.file);
}));
platformRoutes.post("/:id/reports", upload.single("file"), handler(async (req, res) => {
  if (!req.file) throw badRequest("Attach a file");
  const body = parse(reportUploadSchema, {
    kind: req.body.kind, month: req.body.month, note: req.body.note || undefined,
    mapping: req.body.mapping ? JSON.parse(String(req.body.mapping)) : undefined,
    amountPaise: req.body.amountPaise ? Number(req.body.amountPaise) : undefined,
  });
  res.status(201);
  return svc.upload(ctx(req), String(req.params.id), req.file, body);
}));
