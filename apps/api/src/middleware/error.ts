import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/errors";
import { env } from "../config/env";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  const msg = String(err?.message ?? "");
  if (/UNIQUE constraint failed/i.test(msg)) {
    res.status(409).json({ error: { code: "CONFLICT", message: "A record with these details already exists" } });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "TOO_LARGE", message: "Upload is too large" } });
    return;
  }
  if (!env.isTest) console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
};
