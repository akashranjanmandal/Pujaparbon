import { Router } from "express";
import { claimSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as svc from "./service";

export const claimRoutes = Router();
claimRoutes.use(requirePermission("platforms.manage"));
claimRoutes.get("/", handler((req) => svc.list(ctx(req).tenantId, str(req.query.platformId))));
claimRoutes.post("/", handler(async (req, res) => { res.status(201); return svc.create(ctx(req), parse(claimSchema, req.body)); }));
claimRoutes.patch("/:id", handler((req) => svc.update(ctx(req), String(req.params.id), parse(claimSchema.partial(), req.body))));
claimRoutes.delete("/:id", handler((req) => svc.remove(ctx(req), String(req.params.id))));
