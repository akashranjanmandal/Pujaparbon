import { Router } from "express";
import { z } from "zod";
import { entrySchema, lossSchema, partySchema, returnSchema, saleSchema, transferSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import { needBusiness } from "../../lib/isolation";
import * as svc from "./service";

const created = <T>(res: { status: (n: number) => unknown }, v: T) => { res.status(201); return v; };

export const saleRoutes = Router();
saleRoutes.get("/", requirePermission("sales.manage"), handler((req) => svc.listSales(ctx(req).tenantId, { from: str(req.query.from), to: str(req.query.to), businessId: needBusiness(req.query.businessId), limit: Number(req.query.limit) || 100 })));
saleRoutes.post("/", requirePermission("sales.manage"), handler(async (req, res) => created(res, await svc.createSale(ctx(req), parse(saleSchema, req.body)))));
saleRoutes.delete("/:id", requirePermission("sales.manage"), handler((req) => svc.removeSale(ctx(req), String(req.params.id))));

export const lossRoutes = Router();
lossRoutes.get("/", requirePermission("losses.manage"), handler((req) => svc.listLossesAndReturns(ctx(req).tenantId, { from: str(req.query.from), to: str(req.query.to), businessId: needBusiness(req.query.businessId) })));
lossRoutes.post("/", requirePermission("losses.manage"), handler(async (req, res) => created(res, await svc.createLoss(ctx(req), parse(lossSchema, req.body)))));
lossRoutes.post("/returns", requirePermission("losses.manage"), handler(async (req, res) => created(res, await svc.createReturn(ctx(req), parse(returnSchema, req.body)))));

export const placeStockRoutes = Router();
placeStockRoutes.get("/", requirePermission("stock.view"), handler((req) => svc.stockByPlace(ctx(req).tenantId, needBusiness(req.query.businessId))));
placeStockRoutes.post("/transfer", requirePermission("stock.count"), handler((req) => svc.transfer(ctx(req), parse(transferSchema, req.body))));

export const dueRoutes = Router();
dueRoutes.get("/", requirePermission("dues.manage"), handler((req) => svc.listParties(ctx(req).tenantId, needBusiness(req.query.businessId))));
dueRoutes.post("/", requirePermission("dues.manage"), handler(async (req, res) => created(res, await svc.createParty(ctx(req), parse(partySchema, req.body)))));
dueRoutes.post("/entries", requirePermission("dues.manage"), handler(async (req, res) => created(res, await svc.addEntry(ctx(req), parse(entrySchema, req.body)))));
dueRoutes.get("/:id/entries", requirePermission("dues.manage"), handler((req) => svc.partyEntriesFor(ctx(req).tenantId, String(req.params.id))));

export const accountRoutes = Router();
const range = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
accountRoutes.get("/", requirePermission("accounts.view"), handler((req) => svc.accounts(ctx(req).tenantId, parse(range, { from: req.query.from, to: req.query.to }))));
