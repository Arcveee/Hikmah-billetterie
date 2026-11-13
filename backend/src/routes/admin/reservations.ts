import { Router } from "express";
import { z } from "zod";
import { ReservationStatus, PaymentMethod } from "@prisma/client";
import prisma from "../../lib/prisma";
import { requireAdmin, type AuthRequest } from "../../middleware/auth";
import { apiError, param } from "../../lib/errors";
import { logAudit } from "../../lib/audit";

const router = Router();

const flatQuery = (q: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

// GET /api/admin/reservations
router.get("/reservations", requireAdmin, async (req, res) => {
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    zoneId: z.string().optional(),
    busId: z.string().optional(),
    status: z.nativeEnum(ReservationStatus).optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    pickupPointId: z.string().optional(),
    search: z.string().optional(),
  });
  const parsed = schema.safeParse(flatQuery(req.query));
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Paramètres invalides.");

  const { page, limit, zoneId, busId, status, paymentMethod, pickupPointId, search } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    ...(zoneId && { zoneId }),
    ...(busId && { busId }),
    ...(status && { status }),
    ...(paymentMethod && { paymentMethod }),
    ...(pickupPointId && { pickupPointId }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
        { reference: { contains: search.toUpperCase() } },
      ],
    }),
  };

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        zone: { select: { name: true } },
        bus: { select: { label: true } },
        pickupPoint: { select: { name: true } },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return res.json({ reservations, total, page, limit, pages: Math.ceil(total / limit) });
});

// POST /api/admin/reservations/:id/cancel
router.post("/reservations/:id/cancel", requireAdmin, async (req: AuthRequest, res) => {
  const id = param(req.params.id);
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Réservation introuvable.");
  if (reservation.status === ReservationStatus.CANCELLED) return apiError(res, 409, "ALREADY_CANCELLED", "Déjà annulée.");

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: ReservationStatus.CANCELLED },
  });
  await logAudit(req.admin!.adminId, "CANCEL_RESERVATION", "Reservation", id, { reference: reservation.reference });
  return res.json({ reservation: updated });
});

// POST /api/admin/reservations/:id/move
router.post("/reservations/:id/move", requireAdmin, async (req: AuthRequest, res) => {
  const id = param(req.params.id);
  const schema = z.object({
    busId: z.string().cuid(),
    confirmCrossZone: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "busId requis.");

  const [reservation, targetBus] = await Promise.all([
    prisma.reservation.findUnique({ where: { id } }),
    prisma.bus.findUnique({ where: { id: parsed.data.busId }, include: { zone: true } }),
  ]);
  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Réservation introuvable.");
  if (!targetBus) return apiError(res, 404, "NOT_FOUND", "Bus cible introuvable.");
  if (reservation.status === ReservationStatus.CANCELLED) return apiError(res, 409, "CANCELLED", "Réservation annulée.");

  if (targetBus.zoneId !== reservation.zoneId && !parsed.data.confirmCrossZone) {
    return res.status(409).json({
      error: { code: "CROSS_ZONE_MOVE", message: `Ce bus appartient à la zone ${targetBus.zone.name}. Confirmez avec confirmCrossZone: true.` },
    });
  }

  const now = new Date();
  const taken = await prisma.reservation.aggregate({
    where: {
      busId: parsed.data.busId,
      id: { not: id },
      OR: [
        { status: ReservationStatus.PAID },
        { status: ReservationStatus.PENDING, expiresAt: { gt: now } },
      ],
    },
    _sum: { seats: true },
  });
  const remaining = targetBus.capacity - (taken._sum.seats ?? 0);
  if (remaining < reservation.seats) {
    return apiError(res, 409, "NO_SPACE", `Le bus cible n'a que ${remaining} place(s) disponible(s).`);
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { busId: parsed.data.busId, zoneId: targetBus.zoneId },
  });
  await logAudit(req.admin!.adminId, "MOVE_RESERVATION", "Reservation", id, {
    reference: reservation.reference,
    fromBusId: reservation.busId,
    toBusId: parsed.data.busId,
    crossZone: targetBus.zoneId !== reservation.zoneId,
  });
  return res.json({ reservation: updated });
});

// POST /api/admin/reservations/:id/mark-paid
router.post("/reservations/:id/mark-paid", requireAdmin, async (req: AuthRequest, res) => {
  const id = param(req.params.id);
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Réservation introuvable.");
  if (reservation.status === ReservationStatus.PAID) return apiError(res, 409, "ALREADY_PAID", "Déjà payée.");
  if (reservation.status === ReservationStatus.CANCELLED) return apiError(res, 409, "CANCELLED", "Réservation annulée.");

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: ReservationStatus.PAID, paymentMethod: PaymentMethod.CASH, paidAt: new Date() },
  });
  await logAudit(req.admin!.adminId, "MARK_PAID_CASH", "Reservation", id, { reference: reservation.reference });
  return res.json({ reservation: updated });
});

// POST /api/admin/checkin
router.post("/checkin", requireAdmin, async (req: AuthRequest, res) => {
  const schema = z.object({ reference: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Référence requise.");

  const reservation = await prisma.reservation.findUnique({
    where: { reference: parsed.data.reference.toUpperCase() },
    include: {
      zone: { select: { name: true } },
      bus: { select: { label: true } },
    },
  });

  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Référence introuvable.");
  if (reservation.status === ReservationStatus.CANCELLED) return apiError(res, 409, "CANCELLED", "Réservation annulée.");
  if (reservation.status !== ReservationStatus.PAID) return apiError(res, 409, "NOT_PAID", "Paiement non confirmé.");
  if (reservation.checkedInAt) {
    return res.status(409).json({
      error: { code: "ALREADY_CHECKED_IN", message: "Billet déjà validé." },
      reservation,
    });
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { checkedInAt: new Date() },
    include: { zone: { select: { name: true } }, bus: { select: { label: true } } },
  });
  await logAudit(req.admin!.adminId, "CHECKIN", "Reservation", reservation.id, { reference: reservation.reference });
  return res.json({
    ok: true,
    message: `Bienvenue ${reservation.firstName} — ${reservation.zone.name} · ${reservation.bus.label}`,
    reservation: updated,
  });
});

// GET /api/admin/refunds
router.get("/refunds", requireAdmin, async (_req, res) => {
  const reservations = await prisma.reservation.findMany({
    where: { refundRequired: true },
    include: {
      zone: { select: { name: true } },
      bus: { select: { label: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ reservations });
});

export default router;
