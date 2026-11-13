import prisma from "../lib/prisma";

export async function logAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
) {
  await prisma.auditLog.create({
    data: { adminId, action, targetType, targetId, details: details as object },
  });
}
