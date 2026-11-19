import path from "node:path";
import { defineConfig } from "vitest/config";

const testDb = path.resolve(__dirname, "data/test.db");

export default defineConfig({
  test: {
    env: { DB_URL: `file:${testDb}`, NODE_ENV: "test", JWT_ACCESS_SECRET: "test-access", JWT_REFRESH_SECRET: "test-refresh" },
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: { conditions: ["node"] },
});
