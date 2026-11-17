import { createApp } from "./app";
import { env } from "./config/env";
import { runMigrations } from "./db/migrate";

await runMigrations();
createApp().listen(env.port, () => {
  console.log(`Puja Parbon API on http://localhost:${env.port} (db: ${env.db.mode})`);
});
