import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env";
import { badRequest } from "../../lib/errors";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** Saves a live-camera selfie. Path is built from ids only, never from user input. */
export async function saveSelfie(tenantId: string, date: string, attendanceId: string, kind: "in" | "out", dataUrl: string) {
  const buf = Buffer.from(dataUrl.slice("data:image/jpeg;base64,".length), "base64");
  if (buf.length < 1000 || !buf.subarray(0, 3).equals(JPEG_MAGIC)) throw badRequest("Selfie is not a valid photo");
  const rel = path.join("selfies", tenantId, date, `${attendanceId}-${kind}.jpg`);
  const abs = path.join(env.uploadDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
  return rel;
}

export function selfiePath(rel: string) {
  const abs = path.resolve(env.uploadDir, rel);
  if (!abs.startsWith(path.resolve(env.uploadDir))) throw badRequest("Invalid path");
  return abs;
}
