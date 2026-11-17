import fs from "node:fs";
import path from "node:path";

export default async function setup() {
  const file = path.resolve(__dirname, "../data/test.db");
  for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
  fs.rmSync(path.resolve(__dirname, "../data/test-uploads"), { recursive: true, force: true });
  process.env.DB_URL = `file:${file}`;
  process.env.JWT_ACCESS_SECRET = "test-access";
  process.env.JWT_REFRESH_SECRET = "test-refresh";
  const { runMigrations } = await import("../src/db/migrate");
  await runMigrations();
}
