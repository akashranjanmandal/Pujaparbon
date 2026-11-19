import { Router } from "express";
import { tripSchema } from "@pp/shared";
import { requirePermission } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler, str } from "../../lib/http";
import * as trips from "./service";

export const tripRoutes = Router();
tripRoutes.use(requirePermission("buy.manage"));
tripRoutes.get("/", handler((req) => trips.list(ctx(req).tenantId, { from: str(req.query.from), to: str(req.query.to) })));
tripRoutes.post("/", handler(async (req, res) => {
  res.status(201);
  return trips.create(ctx(req), parse(tripSchema, req.body));
}));
tripRoutes.get("/:id", handler((req) => trips.get(ctx(req).tenantId, String(req.params.id))));
tripRoutes.delete("/:id", handler((req) => trips.remove(ctx(req), String(req.params.id))));
