import { Prisma, PrismaClient, ReservationStatus, TripType, PaymentMethod } from "@prisma/client";
import { generateReference, generatePublicToken } from "../lib/reference";

export interface CreateReservationInput {
  firstName: string;
  lastName: string;
  phone: string;
  neighborhood?: string;
  zoneId: string;
  pickupPointId: string;
  seats: number;
  tripType: TripType;
  paymentMethod: PaymentMethod;
  acknowledgeDuplicate?: boolean;
}

export type CreateReservationResult =
  | { ok: true; reservation: { id: string; reference: string; publicToken: string; amountXof: number; expiresAt: Date } }
  | { ok: false; code: "NO_BUS_AVAILABLE"; zoneId: string; maxAvailable: number; zonesWithSeats: string[] }
  | { ok: false; code: "DUPLICATE_RESERVATION"; existing: { id: string; reference: string; status: ReservationStatus } }
  | { ok: false; code: "INVALID_PICKUP_POINT" }
  | { ok: false; code: "ZONE_NOT_FOUND" }
  | { ok: false; code: "SETTINGS_NOT_FOUND" };

export async function createReservation(
  input: CreateReservationInput,
  db?: PrismaClient,
): Promise<CreateReservationResult> {
  // Charge le singleton uniquement si aucun client n'est injecté
  const client = db ?? (await import("../lib/prisma")).default;

  return client.$transaction(async (tx) => {
    // 1. Réglages
    const settings = await tx.settings.findFirst();
    if (!settings) return { ok: false, code: "SETTINGS_NOT_FOUND" } as const;

    // 2. Zone
    const zone = await tx.zone.findUnique({ where: { id: input.zoneId, isActive: true } });
    if (!zone) return { ok: false, code: "ZONE_NOT_FOUND" } as const;

    // 3. Point de ramassage appartient à la zone
    const pickup = await tx.pickupPoint.findUnique({ where: { id: input.pickupPointId, isActive: true } });
    if (!pickup || pickup.zoneId !== input.zoneId) {
      return { ok: false, code: "INVALID_PICKUP_POINT" } as const;
    }

    // 4. Anti-doublon téléphone
    if (!input.acknowledgeDuplicate) {
      const duplicate = await tx.reservation.findFirst({
        where: {
          phone: input.phone,
          OR: [
            { status: ReservationStatus.PAID },
            { status: ReservationStatus.PENDING, expiresAt: { gt: new Date() } },
          ],
        },
        select: { id: true, reference: true, status: true },
      });
      if (duplicate) {
        return { ok: false, code: "DUPLICATE_RESERVATION", existing: duplicate } as const;
      }
    }

    // 5. SELECT FOR UPDATE sur les bus ouverts de la zone, triés par number ASC
    const now = new Date();
    const buses = await tx.$queryRaw<{ id: string; capacity: number; number: number }[]>(
      Prisma.sql`
        SELECT id, capacity, number
        FROM "Bus"
        WHERE "zoneId" = ${input.zoneId}
          AND "isOpen" = true
        ORDER BY number ASC
        FOR UPDATE
      `,
    );

    if (buses.length === 0) {
      const zonesWithSeats = await getZonesWithSeats(tx, input.zoneId);
      return { ok: false, code: "NO_BUS_AVAILABLE", zoneId: input.zoneId, maxAvailable: 0, zonesWithSeats } as const;
    }

    // 6. Places restantes = capacité − (PAID + PENDING non expirées)
    const busIds = buses.map((b) => b.id);
    const occupancies = await tx.reservation.groupBy({
      by: ["busId"],
      where: {
        busId: { in: busIds },
        OR: [
          { status: ReservationStatus.PAID },
          { status: ReservationStatus.PENDING, expiresAt: { gt: now } },
        ],
      },
      _sum: { seats: true },
    });

    const taken = new Map(occupancies.map((o) => [o.busId, o._sum.seats ?? 0]));

    // 7. Premier bus qui accueille le groupe entier
    let chosenBusId: string | null = null;
    let maxAvailable = 0;
    for (const bus of buses) {
      const remaining = bus.capacity - (taken.get(bus.id) ?? 0);
      if (remaining > maxAvailable) maxAvailable = remaining;
      if (chosenBusId === null && remaining >= input.seats) chosenBusId = bus.id;
    }

    if (chosenBusId === null) {
      const zonesWithSeats = await getZonesWithSeats(tx, input.zoneId);
      return { ok: false, code: "NO_BUS_AVAILABLE", zoneId: input.zoneId, maxAvailable, zonesWithSeats } as const;
    }

    // 8. Montant calculé côté serveur
    const amountXof =
      input.tripType === TripType.ROUND_TRIP
        ? settings.priceRoundTripXof * input.seats
        : settings.priceOneWayXof * input.seats;

    const expiresAt = new Date(now.getTime() + settings.lockMinutes * 60 * 1000);

    // 9. Crée la réservation PENDING
    const reservation = await tx.reservation.create({
      data: {
        reference: generateReference(),
        publicToken: generatePublicToken(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        neighborhood: input.neighborhood,
        zoneId: input.zoneId,
        pickupPointId: input.pickupPointId,
        seats: input.seats,
        tripType: input.tripType,
        busId: chosenBusId,
        amountXof,
        paymentMethod: input.paymentMethod,
        status: ReservationStatus.PENDING,
        expiresAt,
      },
      select: { id: true, reference: true, publicToken: true, amountXof: true, expiresAt: true },
    });

    return { ok: true, reservation } as const;
  });
}

async function getZonesWithSeats(
  tx: Prisma.TransactionClient,
  excludeZoneId: string,
): Promise<string[]> {
  const now = new Date();
  const zones = await tx.zone.findMany({
    where: { isActive: true, id: { not: excludeZoneId } },
    include: {
      buses: {
        where: { isOpen: true },
        include: {
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
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  return zones
    .filter((z) => z.buses.some((b) => b.capacity - b.reservations.reduce((s, r) => s + r.seats, 0) > 0))
    .map((z) => z.name);
}

export async function expireReservations(db?: PrismaClient): Promise<number> {
  const client = db ?? (await import("../lib/prisma")).default;
  const result = await client.reservation.updateMany({
    where: { status: ReservationStatus.PENDING, expiresAt: { lte: new Date() } },
    data: { status: ReservationStatus.EXPIRED },
  });
  return result.count;
}
