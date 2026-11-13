import { Router } from "express";
import { z } from "zod";
import { TripType, PaymentMethod, ReservationStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { apiError, param } from "../lib/errors";
import { normalizePhone } from "../lib/phone";
import { createReservation, expireReservations } from "../services/reservation.service";
import { reservationLimiter } from "../middleware/rateLimits";
import { createCharge } from "../lib/payment";

const router = Router();

// GET /api/public/config
router.get("/public/config", async (_req, res) => {
  const [settings, zones] = await Promise.all([
    prisma.settings.findFirst(),
    prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        pickupPoints: { where: { isActive: true }, select: { id: true, name: true } },
        buses: {
          where: { isOpen: true },
          include: {
            reservations: {
              where: {
                OR: [
                  { status: ReservationStatus.PAID },
                  { status: ReservationStatus.PENDING, expiresAt: { gt: new Date() } },
                ],
              },
              select: { seats: true },
            },
          },
        },
      },
    }),
  ]);

  if (!settings) return apiError(res, 503, "NOT_CONFIGURED", "La billetterie n'est pas encore configurée.");

  const zonesData = zones.map((z) => {
    const totalCapacity = z.buses.reduce((s, b) => s + b.capacity, 0);
    const totalTaken = z.buses.reduce(
      (s, b) => s + b.reservations.reduce((rs, r) => rs + r.seats, 0),
      0,
    );
    const remaining = Math.max(0, totalCapacity - totalTaken);
    return {
      id: z.id,
      name: z.name,
      displayOrder: z.displayOrder,
      pickupPoints: z.pickupPoints,
      remainingSeats: remaining,
      isFull: remaining === 0,
    };
  });

  return res.json({
    event: {
      name: settings.eventName,
      date: settings.eventDate,
      venue: settings.venue,
      whatsappContact: settings.whatsappContact,
    },
    pricing: {
      roundTripXof: settings.priceRoundTripXof,
      oneWayXof: settings.priceOneWayXof,
    },
    maxSeatsPerOrder: settings.maxSeatsPerOrder,
    zones: zonesData,
  });
});

// POST /api/reservations
const createSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string(),
  neighborhood: z.string().max(100).optional(),
  zoneId: z.string().cuid(),
  pickupPointId: z.string().cuid(),
  seats: z.number().int().min(1).max(6),
  tripType: z.nativeEnum(TripType),
  paymentMethod: z.enum(["WAVE", "ORANGE_MONEY"]),
  acknowledgeDuplicate: z.boolean().optional(),
});

router.post("/reservations", reservationLimiter, async (req, res) => {
  await expireReservations();

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return apiError(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Données invalides.");
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return apiError(res, 400, "INVALID_PHONE", "Numéro sénégalais invalide (ex. 77 123 45 67).");
  }

  const settings = await prisma.settings.findFirst();
  if (parsed.data.seats > (settings?.maxSeatsPerOrder ?? 6)) {
    return apiError(res, 400, "TOO_MANY_SEATS", `Maximum ${settings?.maxSeatsPerOrder ?? 6} places par réservation.`);
  }

  const result = await createReservation({ ...parsed.data, phone, paymentMethod: parsed.data.paymentMethod as PaymentMethod });

  if (!result.ok) {
    if (result.code === "NO_BUS_AVAILABLE") {
      const zoneNames = result.zonesWithSeats;
      const suggestion = zoneNames.length > 0 ? ` Il reste des places à ${zoneNames.join(" et ")}.` : "";
      const msg = result.maxAvailable === 0
        ? `Les bus de cette zone sont complets.${suggestion}`
        : `Il ne reste que ${result.maxAvailable} place(s) dans un même bus. Réduisez le nombre de places ou contactez la commission.${suggestion}`;
      return res.status(409).json({ error: { code: "NO_BUS_AVAILABLE", message: msg, maxAvailable: result.maxAvailable, zonesWithSeats: result.zonesWithSeats } });
    }
    if (result.code === "DUPLICATE_RESERVATION") {
      return res.status(409).json({ error: { code: "DUPLICATE_RESERVATION", message: "Une réservation active existe déjà pour ce numéro.", existing: result.existing } });
    }
    return apiError(res, 400, result.code, "Réservation impossible.");
  }

  return res.status(201).json({ reservation: result.reservation });
});

// POST /api/reservations/:id/pay
router.post("/reservations/:id/pay", reservationLimiter, async (req, res) => {
  const schema = z.object({ paymentMethod: z.enum(["WAVE", "ORANGE_MONEY"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Moyen de paiement invalide.");

  const reservation = await prisma.reservation.findUnique({
    where: { id: param(req.params.id) },
    select: { id: true, reference: true, status: true, expiresAt: true, amountXof: true, phone: true, firstName: true, lastName: true },
  });
  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Réservation introuvable.");
  if (reservation.status === ReservationStatus.PAID) return apiError(res, 409, "ALREADY_PAID", "Cette réservation est déjà payée.");
  if (reservation.status !== ReservationStatus.PENDING || reservation.expiresAt < new Date()) {
    return apiError(res, 409, "RESERVATION_EXPIRED", "Cette réservation a expiré. Veuillez recommencer.");
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const charge = await createCharge({
    reservationId: reservation.id,
    reference: reservation.reference,
    amountXof: reservation.amountXof,
    paymentMethod: parsed.data.paymentMethod,
    customerPhone: reservation.phone,
    customerName: `${reservation.firstName} ${reservation.lastName}`,
    returnUrl: `${frontendUrl}/confirmation?ref=${reservation.reference}`,
  });

  await prisma.payment.create({
    data: {
      reservationId: reservation.id,
      provider: "bictorys",
      providerRef: charge.chargeId,
      amountXof: reservation.amountXof,
      rawPayload: charge as object,
    },
  });

  return res.json({ paymentUrl: charge.paymentUrl, chargeId: charge.chargeId });
});

// GET /api/reservations/lookup?reference=&phone=
router.get("/reservations/lookup", reservationLimiter, async (req, res) => {
  const schema = z.object({
    reference: z.string().min(1),
    phone: z.string().min(1),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Référence et téléphone requis.");

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return apiError(res, 400, "INVALID_PHONE", "Numéro invalide.");

  const reservation = await prisma.reservation.findFirst({
    where: { reference: parsed.data.reference.toUpperCase(), phone },
    include: {
      zone: { select: { name: true } },
      bus: { select: { label: true, departureTime: true, arrivalTime: true, returnTime: true, returnLocation: true } },
      pickupPoint: { select: { name: true } },
    },
  });

  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Réservation introuvable.");
  return res.json({ reservation });
});

// GET /api/reservations/:reference/status
router.get("/reservations/:reference/status", async (req, res) => {
  const reservation = await prisma.reservation.findUnique({
    where: { reference: req.params.reference.toUpperCase() },
    select: { id: true, reference: true, status: true, paidAt: true, expiresAt: true, publicToken: true },
  });
  if (!reservation) return apiError(res, 404, "NOT_FOUND", "Réservation introuvable.");
  return res.json({ reservation });
});

export default router;
