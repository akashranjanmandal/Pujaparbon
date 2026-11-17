import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../config/env";
import * as schema from "./schema";

export const libsql = createClient({ url: env.db.url, authToken: env.db.authToken });
export const db = drizzle(libsql, { schema });
export type DB = typeof db;
/** A transaction handle has the same query API as db. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;
export { schema };
