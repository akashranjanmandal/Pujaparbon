import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@pp/shared";
import { env } from "../config/env";

export interface AccessClaims {
  sub: string;
  tid: string;
  role: Role;
  eid: string | null;
}

export const signAccessToken = (c: AccessClaims) =>
  jwt.sign(c, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtlSec, issuer: "pp-api", audience: "pp-web" });

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.jwt.accessSecret, { issuer: "pp-api", audience: "pp-web" }) as AccessClaims;
}

/** Refresh tokens are opaque random strings; only their SHA-256 hash is stored. */
export const newRefreshToken = () => crypto.randomBytes(48).toString("base64url");
export const hashToken = (t: string) =>
  crypto.createHmac("sha256", env.jwt.refreshSecret).update(t).digest("hex");
