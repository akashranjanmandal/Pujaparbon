import { Router } from "express";
import { z } from "zod";
import { batchSchema, courierMoveSchema, fundTransferSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as svc from "./service";

const range = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const created = <T>(res: { status: (n: number) => unknown }, v: T) => { res.status(201); return v; };

export const batchRoutes = Router();
batchRoutes.get("/", requirePermission("stock.view"), handler((req) => svc.listBatches(ctx(req).tenantId, str(req.query.businessId))));
batchRoutes.post("/", requirePermission("stock.count"), handler(async (req, res) => created(res, await svc.createBatch(ctx(req), parse(batchSchema, req.body)))));

export const courierRoutes = Router();
courierRoutes.use(requirePermission("platforms.manage"));
courierRoutes.get("/", handler((req) => svc.listCourierMoves(ctx(req).tenantId, parse(range, { from: req.query.from, to: req.query.to }))));
courierRoutes.post("/", handler(async (req, res) => created(res, await svc.addCourierMove(ctx(req), parse(courierMoveSchema, req.body)))));
courierRoutes.delete("/:id", handler((req) => svc.removeCourierMove(ctx(req), String(req.params.id))));

export const moneyRoutes = Router();
moneyRoutes.use(requirePermission("accounts.view"));
moneyRoutes.get("/gst", handler((req) => svc.gst(ctx(req).tenantId, parse(range, { from: req.query.from, to: req.query.to }))));
moneyRoutes.get("/places", handler((req) => svc.placeAccounts(ctx(req).tenantId, parse(range, { from: req.query.from, to: req.query.to }))));
moneyRoutes.get("/transfers", handler((req) => svc.listTransfers(ctx(req).tenantId, parse(range, { from: req.query.from, to: req.query.to }))));
moneyRoutes.post("/transfers", handler(async (req, res) => created(res, await svc.addTransfer(ctx(req), parse(fundTransferSchema, req.body)))));
