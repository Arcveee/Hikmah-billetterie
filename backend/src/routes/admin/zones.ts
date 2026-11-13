import { Router } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { requireAdmin, type AuthRequest } from "../../middleware/auth";
import { apiError, param } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

const router = Router();

router.get("/zones", requireAdmin, async (_req, res) => {
  const zones = await prisma.zone.findMany({ orderBy: { displayOrder: "asc" } });
  return res.json({ zones });
});

router.post("/zones", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(100), displayOrder: z.number().int().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Données invalides.");

  const zone = await prisma.zone.create({ data: parsed.data });
  await logAudit(req.admin!.adminId, "CREATE_ZONE", "Zone", zone.id, { name: zone.name });
  return res.status(201).json({ zone });
});

router.patch("/zones/:id", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Données invalides.");

  const zone = await prisma.zone.update({ where: { id: param(req.params.id) }, data: parsed.data }).catch(() => null);
  if (!zone) return apiError(res, 404, "NOT_FOUND", "Zone introuvable.");
  await logAudit(req.admin!.adminId, "UPDATE_ZONE", "Zone", param(req.params.id), parsed.data as Record<string, unknown>);
  return res.json({ zone });
});

export default router;
