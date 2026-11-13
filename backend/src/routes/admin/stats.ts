import { Router } from "express";
import { ReservationStatus, PaymentMethod } from "@prisma/client";
import prisma from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";

const router = Router();

router.get("/stats", requireAdmin, async (_req, res) => {
  const now = new Date();

  const [zones, reservations] = await Promise.all([
    prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        buses: { include: { reservations: { select: { seats: true, status: true, paymentMethod: true, amountXof: true } } } },
      },
    }),
    prisma.reservation.findMany({
      select: { status: true, seats: true, amountXof: true, paymentMethod: true, expiresAt: true },
    }),
  ]);

  const active = reservations.filter(
    (r) => r.status === ReservationStatus.PAID ||
      (r.status === ReservationStatus.PENDING && r.expiresAt > now),
  );

  const revenueBy = (method: PaymentMethod) =>
    reservations
      .filter((r) => r.status === ReservationStatus.PAID && r.paymentMethod === method)
      .reduce((s, r) => s + r.amountXof, 0);

  const global = {
    total: active.length,
    paid: reservations.filter((r) => r.status === ReservationStatus.PAID).length,
    pending: reservations.filter((r) => r.status === ReservationStatus.PENDING && r.expiresAt > now).length,
    seatsTaken: active.reduce((s, r) => s + r.seats, 0),
    revenue: reservations.filter((r) => r.status === ReservationStatus.PAID).reduce((s, r) => s + r.amountXof, 0),
    revenueWave: revenueBy(PaymentMethod.WAVE),
    revenueOrangeMoney: revenueBy(PaymentMethod.ORANGE_MONEY),
    revenueCash: revenueBy(PaymentMethod.CASH),
  };

  const byZone = zones.map((z) => {
    const allRes = z.buses.flatMap((b) => b.reservations);
    const zoneActive = allRes.filter(
      (r) => r.status === ReservationStatus.PAID || r.status === ReservationStatus.PENDING,
    );
    const zonePaid = allRes.filter((r) => r.status === ReservationStatus.PAID);
    const totalCapacity = z.buses.reduce((s, b) => s + b.capacity, 0);
    const seatsTaken = zoneActive.reduce((s, r) => s + r.seats, 0);
    const fullBuses = z.buses.filter((b) => {
      const taken = b.reservations
        .filter((r) => r.status === ReservationStatus.PAID || r.status === ReservationStatus.PENDING)
        .reduce((s, r) => s + r.seats, 0);
      return taken >= b.capacity;
    }).length;

    return {
      zoneId: z.id,
      zoneName: z.name,
      total: zoneActive.length,
      paid: zonePaid.length,
      seatsTaken,
      remainingSeats: Math.max(0, totalCapacity - seatsTaken),
      totalBuses: z.buses.length,
      fullBuses,
    };
  });

  return res.json({ global, byZone });
});

export default router;
