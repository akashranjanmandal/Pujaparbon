import "dotenv/config";
import path from "node:path";

const required = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
};

/**
 * Database: Turso when URL + token are set; otherwise a local libSQL file (same engine) so the demo runs offline.
 * Tests set DB_URL to an isolated file.
 */
function resolveDb() {
  if (process.env.DB_URL) return { url: process.env.DB_URL, authToken: undefined, mode: "override" as const };
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (url && url.startsWith("libsql://") && authToken) return { url, authToken, mode: "turso" as const };
  if (url && url.startsWith("libsql://") && !authToken) {
    console.warn("[db] TURSO_AUTH_TOKEN is empty — using local database file data/local.db instead of Turso.");
  }
  return { url: `file:${path.resolve(process.cwd(), "data/local.db")}`, authToken: undefined, mode: "local" as const };
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isTest: process.env.NODE_ENV === "test" || !!process.env.VITEST,
  port: Number(process.env.PORT ?? 4000),
  webOrigin: (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(","),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads"),
  db: resolveDb(),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", process.env.VITEST ? "test-access-secret" : undefined),
    refreshSecret: required("JWT_REFRESH_SECRET", process.env.VITEST ? "test-refresh-secret" : undefined),
    accessTtlSec: 15 * 60,
    refreshTtlDays: 7,
  },
};
