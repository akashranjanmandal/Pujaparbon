import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "@pp/shared";

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Express 5 forwards rejected promises, but this keeps handlers typed and tidy. */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  async (req, res, next) => {
    try {
      const out = await fn(req, res, next);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e) {
      next(e);
    }
  };

export const ctx = (req: Request): AuthContext => {
  if (!req.auth) throw new Error("ctx() called on an unauthenticated route");
  return req.auth;
};

export const pageParams = (q: Request["query"]) => {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize ?? 25) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
