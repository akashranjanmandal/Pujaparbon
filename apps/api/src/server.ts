import { createApp } from "./app";
import { env } from "./config/env";
import { runMigrations } from "./db/migrate";
import { purgeOldSelfies } from "./modules/hr/service";

await runMigrations();
// Delete selfies past the owner's retention period now and once a day.
const purge = () => purgeOldSelfies().catch(() => 0);
void purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();
createApp().listen(env.port, () => {
  console.log(`Pujo Parbon API on http://localhost:${env.port} (db: ${env.db.mode})`);
});
