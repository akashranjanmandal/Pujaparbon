import type { RequestHandler } from "express";
import type { Permission } from "@pp/shared";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  try {
    const c = verifyAccessToken(header.slice(7));
    req.auth = { userId: c.sub, tenantId: c.tid, role: c.role, employeeId: c.eid, perms: c.perms ?? [] };
    next();
  } catch {
    next(unauthorized("Session expired"));
  }
};

/** Passes when the user holds ANY of the listed permissions. */
export const requirePermission =
  (...perms: Permission[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!perms.some((p) => req.auth!.perms.includes(p))) return next(forbidden());
    next();
  };
