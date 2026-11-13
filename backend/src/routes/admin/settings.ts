import { Router } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { requireAdmin, type AuthRequest } from "../../middleware/auth";
import { apiError, param } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

const router = Router();

// GET /api/admin/settings
router.get("/settings", requireAdmin, async (_req, res) => {
  const settings = await prisma.settings.findFirst();
  if (!settings) return apiError(res, 404, "NOT_FOUND", "Paramètres non initialisés.");
  return res.json({ settings });
});

// PATCH /api/admin/settings
router.patch("/settings", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({
    eventName: z.string().min(1).optional(),
    eventDate: z.coerce.date().optional(),
    venue: z.string().min(1).optional(),
    priceRoundTripXof: z.number().int().positive().optional(),
    priceOneWayXof: z.number().int().positive().optional(),
    lockMinutes: z.number().int().min(5).max(60).optional(),
    maxSeatsPerOrder: z.number().int().min(1).max(20).optional(),
    whatsappContact: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Données invalides.");

  const settings = await prisma.settings.upsert({
    where: { singleton: true },
    update: parsed.data,
    create: {
      eventName: "",
      eventDate: new Date(),
      venue: "",
      priceRoundTripXof: 0,
      priceOneWayXof: 0,
      whatsappContact: "",
      ...parsed.data,
    },
  });
  await logAudit(req.admin!.adminId, "UPDATE_SETTINGS", "Settings", String(settings.id), parsed.data);
  return res.json({ settings });
});

// GET /api/admin/pickup-points
router.get("/pickup-points", requireAdmin, async (req, res) => {
  const zoneId = typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  const points = await prisma.pickupPoint.findMany({
    where: { ...(zoneId && { zoneId }) },
    include: { zone: { select: { name: true } } },
    orderBy: [{ zoneId: "asc" }, { name: "asc" }],
  });
  return res.json({ pickupPoints: points });
});

// POST /api/admin/pickup-points
router.post("/pickup-points", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({ zoneId: z.string().cuid(), name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "zoneId et name requis.");

  const zone = await prisma.zone.findUnique({ where: { id: parsed.data.zoneId } });
  if (!zone) return apiError(res, 404, "NOT_FOUND", "Zone introuvable.");

  const point = await prisma.pickupPoint.create({ data: parsed.data });
  await logAudit(req.admin!.adminId, "CREATE_PICKUP_POINT", "PickupPoint", point.id, { name: point.name });
  return res.status(201).json({ pickupPoint: point });
});

// PATCH /api/admin/pickup-points/:id
router.patch("/pickup-points/:id", requireAdmin, async (req: AuthRequest, res) => {
  const id = param(req.params.id);
  const schema = z.object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Données invalides.");

  const existing = await prisma.pickupPoint.findUnique({ where: { id } });
  if (!existing) return apiError(res, 404, "NOT_FOUND", "Point de ramassage introuvable.");

  const point = await prisma.pickupPoint.update({ where: { id }, data: parsed.data });
  await logAudit(req.admin!.adminId, "UPDATE_PICKUP_POINT", "PickupPoint", point.id, parsed.data as Record<string, unknown>);
  return res.json({ pickupPoint: point });
});

// DELETE /api/admin/pickup-points/:id
router.delete("/pickup-points/:id", requireAdmin, async (req: AuthRequest, res) => {
  const id = param(req.params.id);
  const existing = await prisma.pickupPoint.findUnique({
    where: { id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!existing) return apiError(res, 404, "NOT_FOUND", "Point de ramassage introuvable.");
  if (existing._count.reservations > 0)
    return apiError(res, 409, "HAS_RESERVATIONS", "Ce point a des réservations associées.");

  await prisma.pickupPoint.delete({ where: { id } });
  await logAudit(req.admin!.adminId, "DELETE_PICKUP_POINT", "PickupPoint", id, { name: existing.name });
  return res.status(204).send();
});

export default router;
