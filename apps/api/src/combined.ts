/**
 * Production entry for single-service hosting (e.g. Render free tier):
 * one Node process serves the REST API under /api/v1 and the Next.js site for everything else.
 */
import http from "node:http";
import path from "node:path";
import next from "next";
import { createApp } from "./app";
import { env } from "./config/env";
import { runMigrations } from "./db/migrate";
import { purgeOldSelfies } from "./modules/hr/service";

const port = Number(process.env.PORT ?? 3000);
const webDir = path.resolve(process.cwd(), "apps/web");

await runMigrations();
// Delete selfies past the owner's retention period now and once a day.
const purge = () => purgeOldSelfies().catch(() => 0);
void purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();
const web = next({ dev: false, dir: webDir });
await web.prepare();
const handleWeb = web.getRequestHandler();
const api = createApp();

http
  .createServer((req, res) => {
    if (req.url?.startsWith("/api/v1")) return api(req, res);
    return handleWeb(req, res);
  })
  .listen(port, () => console.log(`Pujo Parbon (web + api) on :${port} · db ${env.db.mode}`));
