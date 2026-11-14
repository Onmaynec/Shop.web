import type { Prisma } from '@prisma/client';

/** Never include passwords, access tokens, customer emails or raw requests. */
export function auditEntry(input: {
  actorId: string; action: string; targetType: string; targetId?: string;
  details?: Record<string, string | number | boolean | null>;
}): Prisma.AuditLogCreateInput {
  return {
    actor: { connect: { id: input.actorId } },
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    details: input.details ?? {}
  };
}
