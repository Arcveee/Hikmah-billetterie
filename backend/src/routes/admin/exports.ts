import { Router } from "express";
import { ReservationStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";
import { streamPassengersExcel, streamPassengersPdf, toBusGroups } from "../../lib/exports";

const router = Router();

const PAID_FILTER = {
  status: ReservationStatus.PAID,
} as const;

async function fetchBusesWithPassengers(zoneId?: string) {
  return prisma.bus.findMany({
    where: zoneId ? { zoneId } : undefined,
    orderBy: [{ zone: { displayOrder: "asc" } }, { number: "asc" }],
    include: {
      zone: { select: { name: true } },
      reservations: {
        where: PAID_FILTER,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: { pickupPoint: { select: { name: true } } },
        select: {
          reference: true,
          lastName: true,
          firstName: true,
          phone: true,
          seats: true,
          tripType: true,
          status: true,
          paidAt: true,
          checkedInAt: true,
          pickupPoint: { select: { name: true } },
        },
      },
    },
  });
}

// GET /api/admin/export/passengers.xlsx
router.get("/export/passengers.xlsx", requireAdmin, async (req, res) => {
  const zoneId = typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  const buses = await fetchBusesWithPassengers(zoneId);
  await streamPassengersExcel(toBusGroups(buses), res);
});

// GET /api/admin/export/passengers.pdf
router.get("/export/passengers.pdf", requireAdmin, async (req, res) => {
  const zoneId = typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  const buses = await fetchBusesWithPassengers(zoneId);
  streamPassengersPdf(toBusGroups(buses), res);
});

export default router;
