import { Router, type CookieOptions } from "express";
import rateLimit from "express-rate-limit";
import { loginSchema } from "@pp/shared";
import { authenticate } from "../../middleware/auth";
import { parse } from "../../middleware/validate";
import { ctx, handler } from "../../lib/http";
import { env } from "../../config/env";
import * as auth from "./service";

const COOKIE = "pp_rt";
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  path: "/api/v1/auth",
  maxAge: env.jwt.refreshTtlDays * 86_400_000,
};

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: env.isTest ? 1000 : 20, standardHeaders: true, legacyHeaders: false });

export const authRoutes = Router();

authRoutes.post(
  "/login",
  loginLimiter,
  handler(async (req, res) => {
    const { refreshToken, ...rest } = await auth.login(parse(loginSchema, req.body));
    res.cookie(COOKIE, refreshToken, cookieOptions);
    return rest;
  }),
);

authRoutes.post(
  "/refresh",
  handler(async (req, res) => {
    const { refreshToken, ...rest } = await auth.refresh(req.cookies?.[COOKIE]);
    res.cookie(COOKIE, refreshToken, cookieOptions);
    return rest;
  }),
);

authRoutes.post(
  "/logout",
  handler(async (req, res) => {
    await auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    return { ok: true };
  }),
);

authRoutes.get("/me", authenticate, handler((req) => auth.me(ctx(req).userId)));
