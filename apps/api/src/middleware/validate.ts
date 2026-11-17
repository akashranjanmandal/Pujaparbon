import type { ZodTypeAny, z } from "zod";
import { badRequest } from "../lib/errors";

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw badRequest(fields[0] ? `${fields[0].path || "input"}: ${fields[0].message}` : "Invalid input", fields);
  }
  return r.data;
}
