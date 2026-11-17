import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error";
import { authenticate } from "./middleware/auth";
import { notFound } from "./lib/errors";
import { authRoutes } from "./modules/auth/routes";
import { apiRoutes } from "./modules";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(express.json({ limit: "3mb" }));
  app.use(cookieParser());

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, db: env.db.mode });
  });
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1", authenticate, apiRoutes);
  app.use((_req, _res, next) => next(notFound("Route")));
  app.use(errorHandler);
  return app;
}
