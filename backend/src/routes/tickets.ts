import { Router } from "express";
import prisma from "../lib/prisma";
import { streamTicketPdf } from "../lib/pdf";

const router = Router();

// GET /api/tickets/:publicToken.pdf
router.get("/tickets/:publicToken.pdf", async (req, res) => {
  const { publicToken } = req.params;

  const reservation = await prisma.reservation.findUnique({
    where: { publicToken },
    include: {
      zone: { select: { name: true } },
      bus: { select: { label: true, departureTime: true, arrivalTime: true, returnTime: true, returnLocation: true } },
      pickupPoint: { select: { name: true } },
    },
  });

  if (!reservation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Billet introuvable." } });
    return;
  }

  const settings = await prisma.settings.findFirst();

  await streamTicketPdf(
    {
      reference: reservation.reference,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      zoneName: reservation.zone.name,
      busLabel: reservation.bus.label,
      pickupPointName: reservation.pickupPoint.name,
      seats: reservation.seats,
      tripType: reservation.tripType as "ROUND_TRIP" | "ONE_WAY",
      departureTime: reservation.bus.departureTime,
      arrivalTime: reservation.bus.arrivalTime,
      returnTime: reservation.bus.returnTime,
      returnLocation: reservation.bus.returnLocation,
      amountXof: reservation.amountXof,
      eventName: settings?.eventName ?? "20 ans de Hikma",
      eventDate: settings?.eventDate ?? new Date(),
      venue: settings?.venue ?? "Dakar Arena, Diamniadio",
    },
    res,
  );
});

export default router;
