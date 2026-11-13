import { Router } from "express";
import { z } from "zod";
import { ReservationStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { requireAdmin, type AuthRequest } from "../../middleware/auth";
import { apiError, param } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

const router = Router();

const busSchema = z.object({
  zoneId: z.string().cuid(),
  capacity: z.number().int().min(1).max(500),
  isOpen: z.boolean().optional(),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/),
  returnTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  returnLocation: z.string().max(200).optional(),
});

// GET /api/admin/buses?zoneId=
router.get("/buses", requireAdmin, async (req, res) => {
  const zoneId = typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  const now = new Date();

  const buses = await prisma.bus.findMany({
    where: zoneId ? { zoneId } : undefined,
    orderBy: [{ zoneId: "asc" }, { number: "asc" }],
    include: {
      zone: { select: { name: true } },
      _count: { select: { reservations: true } },
      reservations: {
        where: {
          OR: [
            { status: ReservationStatus.PAID },
            { status: ReservationStatus.PENDING, expiresAt: { gt: now } },
          ],
        },
        select: { seats: true },
      },
    },
  });

  const result = buses.map((b) => ({
    id: b.id,
    zoneId: b.zoneId,
    zoneName: b.zone.name,
    number: b.number,
    label: b.label,
    capacity: b.capacity,
    isOpen: b.isOpen,
    departureTime: b.departureTime,
    arrivalTime: b.arrivalTime,
    returnTime: b.returnTime,
    returnLocation: b.returnLocation,
    seatsTaken: b.reservations.reduce((s, r) => s + r.seats, 0),
    remainingSeats: Math.max(0, b.capacity - b.reservations.reduce((s, r) => s + r.seats, 0)),
  }));

  return res.json({ buses: result });
});

// POST /api/admin/buses
router.post("/buses", requireAdmin, async (req: AuthRequest, res) => {
  const parsed = busSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Données invalides.");

  const zone = await prisma.zone.findUnique({ where: { id: parsed.data.zoneId } });
  if (!zone) return apiError(res, 404, "NOT_FOUND", "Zone introuvable.");

  const last = await prisma.bus.findFirst({ where: { zoneId: parsed.data.zoneId }, orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;
  const label = `${zone.name} · Bus ${number}`;

  const bus = await prisma.bus.create({ data: { ...parsed.data, number, label, isOpen: parsed.data.isOpen ?? true } });
  await logAudit(req.admin!.adminId, "CREATE_BUS", "Bus", bus.id, { label, zoneId: bus.zoneId });
  return res.status(201).json({ bus });
});

// POST /api/admin/buses/bulk
router.post("/buses/bulk", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({
    zoneId: z.string().cuid(),
    count: z.number().int().min(1).max(50),
    capacity: z.number().int().min(1).max(500),
    departureTime: z.string().regex(/^\d{2}:\d{2}$/),
    arrivalTime: z.string().regex(/^\d{2}:\d{2}$/),
    returnTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    returnLocation: z.string().max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Données invalides.");

  const zone = await prisma.zone.findUnique({ where: { id: parsed.data.zoneId } });
  if (!zone) return apiError(res, 404, "NOT_FOUND", "Zone introuvable.");

  const last = await prisma.bus.findFirst({ where: { zoneId: parsed.data.zoneId }, orderBy: { number: "desc" } });
  const startNumber = (last?.number ?? 0) + 1;

  const buses = await prisma.$transaction(
    Array.from({ length: parsed.data.count }, (_, i) => {
      const number = startNumber + i;
      return prisma.bus.create({
        data: {
          zoneId: parsed.data.zoneId,
          number,
          label: `${zone.name} · Bus ${number}`,
          capacity: parsed.data.capacity,
          isOpen: true,
          departureTime: parsed.data.departureTime,
          arrivalTime: parsed.data.arrivalTime,
          returnTime: parsed.data.returnTime,
          returnLocation: parsed.data.returnLocation,
        },
      });
    }),
  );

  await logAudit(req.admin!.adminId, "BULK_CREATE_BUS", "Bus", parsed.data.zoneId, { count: parsed.data.count, startNumber });
  return res.status(201).json({ buses, count: buses.length });
});

// PATCH /api/admin/buses/:id
router.patch("/buses/:id", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({
    capacity: z.number().int().min(1).max(500).optional(),
    isOpen: z.boolean().optional(),
    departureTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    returnTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    returnLocation: z.string().max(200).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Données invalides.");

  const bus = await prisma.bus.update({ where: { id: param(req.params.id) }, data: parsed.data }).catch(() => null);
  if (!bus) return apiError(res, 404, "NOT_FOUND", "Bus introuvable.");

  const action = parsed.data.isOpen === true ? "OPEN_BUS" : parsed.data.isOpen === false ? "CLOSE_BUS" : "UPDATE_BUS";
  await logAudit(req.admin!.adminId, action, "Bus", bus.id, parsed.data as Record<string, unknown>);
  return res.json({ bus });
});

// DELETE /api/admin/buses/:id
router.delete("/buses/:id", requireAdmin, async (req: AuthRequest, res) => {
  const now = new Date();
  const activeCount = await prisma.reservation.count({
    where: {
      busId: param(req.params.id),
      OR: [
        { status: ReservationStatus.PAID },
        { status: ReservationStatus.PENDING, expiresAt: { gt: now } },
      ],
    },
  });
  if (activeCount > 0) {
    return apiError(res, 409, "BUS_HAS_RESERVATIONS", `Ce bus a ${activeCount} réservation(s) active(s). Déplacez-les avant de le supprimer.`);
  }

  const bus = await prisma.bus.delete({ where: { id: param(req.params.id) } }).catch(() => null);
  if (!bus) return apiError(res, 404, "NOT_FOUND", "Bus introuvable.");
  await logAudit(req.admin!.adminId, "DELETE_BUS", "Bus", param(req.params.id), { label: bus.label });
  return res.status(204).send();
});

export default router;
