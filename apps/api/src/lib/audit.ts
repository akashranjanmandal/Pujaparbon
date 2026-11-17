import type { Executor } from "../db/client";
import { auditLogs } from "../db/schema";
import type { AuthContext } from "./http";

export async function audit(
  ex: Executor,
  c: Pick<AuthContext, "tenantId" | "userId">,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  await ex.insert(auditLogs).values({ tenantId: c.tenantId, userId: c.userId, action, entity, entityId, meta });
}
