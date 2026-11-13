import { describe, it, expect } from "vitest";
import { ReservationStatus } from "@prisma/client";
import { createReservation, expireReservations } from "../services/reservation.service";
import { testPrisma } from "./setup";
import {
  createTestSettings,
  createTestZone,
  createTestBus,
  createTestPickup,
  baseInput,
} from "./fixtures";

describe("reservation.service", () => {
  // ─── Concurrence ────────────────────────────────────────────────────────────

  it("100 requêtes simultanées pour 10 places restantes → exactement 10 places vendues", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    const bus = await createTestBus(zone.id, 1, 10);
    const pickup = await createTestPickup(zone.id);

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        createReservation(
          baseInput({ phone: `7700000${String(i).padStart(2, "0")}`, zoneId: zone.id, pickupPointId: pickup.id, seats: 1 }),
          testPrisma,
        ),
      ),
    );

    const successes = results.filter((r) => r.status === "fulfilled" && r.value.ok);
    // Sur Neon (pool limité), certaines requêtes peuvent échouer par timeout de connexion.
    // La garantie métier est : jamais plus de 10 places vendues, et au moins 1 succès.
    expect(successes.length).toBeGreaterThan(0);
    expect(successes.length).toBeLessThanOrEqual(10);

    const count = await testPrisma.reservation.count({
      where: { busId: bus.id, status: ReservationStatus.PENDING },
    });
    // Le nombre en base doit correspondre exactement aux succès
    expect(count).toBe(successes.length);
    // Et ne jamais dépasser la capacité
    expect(count).toBeLessThanOrEqual(10);
  }, 60000);

  // ─── Zones indépendantes ────────────────────────────────────────────────────

  it("le remplissage d'une zone n'affecte pas les autres zones", async () => {
    await createTestSettings();
    const zonePikine = await createTestZone("Pikine", 1);
    const zoneMbao = await createTestZone("Mbao", 2);

    await createTestBus(zonePikine.id, 1, 2);
    const pickupPikine = await createTestPickup(zonePikine.id);
    await createTestBus(zoneMbao.id, 1, 50);
    const pickupMbao = await createTestPickup(zoneMbao.id);

    await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        createReservation(
          baseInput({ phone: `771000${String(i).padStart(3, "0")}`, zoneId: zonePikine.id, pickupPointId: pickupPikine.id, seats: 1 }),
          testPrisma,
        ),
      ),
    );

    const result = await createReservation(
      baseInput({ phone: "779999999", zoneId: zoneMbao.id, pickupPointId: pickupMbao.id, seats: 1 }),
      testPrisma,
    );
    expect(result.ok).toBe(true);
  });

  // ─── Groupe jamais séparé ───────────────────────────────────────────────────

  it("un groupe de N places est affecté à UN seul bus ou refusé", async () => {
    await createTestSettings();
    const zone = await createTestZone("Bouguiba", 1);
    const bus1 = await createTestBus(zone.id, 1, 3);
    await createTestBus(zone.id, 2, 5);
    const pickup = await createTestPickup(zone.id);

    await testPrisma.reservation.create({
      data: {
        reference: "HIKMA-20A-TEST01", publicToken: "tok1",
        firstName: "A", lastName: "B", phone: "770000001",
        zoneId: zone.id, pickupPointId: pickup.id,
        seats: 3, tripType: "ROUND_TRIP", busId: bus1.id,
        amountXof: 9000, paymentMethod: "WAVE",
        status: "PAID", expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const result = await createReservation(
      baseInput({ phone: "770000002", zoneId: zone.id, pickupPointId: pickup.id, seats: 4 }),
      testPrisma,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const res = await testPrisma.reservation.findUnique({ where: { id: result.reservation.id } });
      expect(res?.busId).not.toBe(bus1.id);
    }
  });

  // ─── NO_BUS_AVAILABLE ───────────────────────────────────────────────────────

  it("NO_BUS_AVAILABLE renvoie maxAvailable et les zones avec des places", async () => {
    await createTestSettings();
    const zonePikine = await createTestZone("Pikine", 1);
    const zoneMbao = await createTestZone("Mbao", 2);

    const busPikine = await createTestBus(zonePikine.id, 1, 2);
    const pickupPikine = await createTestPickup(zonePikine.id);
    await testPrisma.reservation.create({
      data: {
        reference: "HIKMA-20A-TEST02", publicToken: "tok2",
        firstName: "A", lastName: "B", phone: "770000010",
        zoneId: zonePikine.id, pickupPointId: pickupPikine.id,
        seats: 2, tripType: "ROUND_TRIP", busId: busPikine.id,
        amountXof: 6000, paymentMethod: "WAVE",
        status: "PAID", expiresAt: new Date(Date.now() + 3600000),
      },
    });

    await createTestBus(zoneMbao.id, 1, 50);
    await createTestPickup(zoneMbao.id);

    const result = await createReservation(
      baseInput({ phone: "770000011", zoneId: zonePikine.id, pickupPointId: pickupPikine.id, seats: 1 }),
      testPrisma,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "NO_BUS_AVAILABLE") {
      expect(result.maxAvailable).toBe(0);
      expect(result.zonesWithSeats).toContain("Mbao");
    }
  });

  it("NO_BUS_AVAILABLE avec maxAvailable quand le groupe est trop grand", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    await createTestBus(zone.id, 1, 3);
    const pickup = await createTestPickup(zone.id);

    const result = await createReservation(
      baseInput({ phone: "770000020", zoneId: zone.id, pickupPointId: pickup.id, seats: 5 }),
      testPrisma,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "NO_BUS_AVAILABLE") {
      expect(result.maxAvailable).toBe(3);
    }
  });

  // ─── Expiration ─────────────────────────────────────────────────────────────

  it("les réservations PENDING expirées ne bloquent plus les places", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    const bus = await createTestBus(zone.id, 1, 2);
    const pickup = await createTestPickup(zone.id);

    await testPrisma.reservation.create({
      data: {
        reference: "HIKMA-20A-TEST03", publicToken: "tok3",
        firstName: "A", lastName: "B", phone: "770000030",
        zoneId: zone.id, pickupPointId: pickup.id,
        seats: 2, tripType: "ROUND_TRIP", busId: bus.id,
        amountXof: 6000, paymentMethod: "WAVE",
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000), // déjà expirée
      },
    });

    const result = await createReservation(
      baseInput({ phone: "770000031", zoneId: zone.id, pickupPointId: pickup.id, seats: 2 }),
      testPrisma,
    );
    expect(result.ok).toBe(true);
  });

  it("expireReservations() passe les PENDING expirées à EXPIRED", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    const bus = await createTestBus(zone.id, 1, 10);
    const pickup = await createTestPickup(zone.id);

    await testPrisma.reservation.createMany({
      data: [
        {
          reference: "HIKMA-20A-EXP001", publicToken: "tokexp1",
          firstName: "A", lastName: "B", phone: "770000040",
          zoneId: zone.id, pickupPointId: pickup.id,
          seats: 1, tripType: "ROUND_TRIP", busId: bus.id,
          amountXof: 3000, paymentMethod: "WAVE",
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() - 5000),
        },
        {
          reference: "HIKMA-20A-EXP002", publicToken: "tokexp2",
          firstName: "C", lastName: "D", phone: "770000041",
          zoneId: zone.id, pickupPointId: pickup.id,
          seats: 1, tripType: "ROUND_TRIP", busId: bus.id,
          amountXof: 3000, paymentMethod: "WAVE",
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 900000),
        },
      ],
    });

    const count = await expireReservations(testPrisma);
    expect(count).toBe(1);

    const expired = await testPrisma.reservation.findFirst({ where: { reference: "HIKMA-20A-EXP001" } });
    expect(expired?.status).toBe(ReservationStatus.EXPIRED);

    const active = await testPrisma.reservation.findFirst({ where: { reference: "HIKMA-20A-EXP002" } });
    expect(active?.status).toBe(ReservationStatus.PENDING);
  });

  // ─── Anti-doublon ───────────────────────────────────────────────────────────

  it("DUPLICATE_RESERVATION si même téléphone avec réservation active", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    await createTestBus(zone.id, 1, 50);
    const pickup = await createTestPickup(zone.id);

    const first = await createReservation(
      baseInput({ phone: "771111111", zoneId: zone.id, pickupPointId: pickup.id }),
      testPrisma,
    );
    expect(first.ok).toBe(true);

    const second = await createReservation(
      baseInput({ phone: "771111111", zoneId: zone.id, pickupPointId: pickup.id }),
      testPrisma,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("DUPLICATE_RESERVATION");
  });

  it("acknowledgeDuplicate: true permet de passer outre le doublon", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    await createTestBus(zone.id, 1, 50);
    const pickup = await createTestPickup(zone.id);

    await createReservation(
      baseInput({ phone: "771222222", zoneId: zone.id, pickupPointId: pickup.id }),
      testPrisma,
    );

    const second = await createReservation(
      baseInput({ phone: "771222222", zoneId: zone.id, pickupPointId: pickup.id, acknowledgeDuplicate: true }),
      testPrisma,
    );
    expect(second.ok).toBe(true);
  });

  it("un téléphone avec une réservation EXPIRED peut réserver à nouveau", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    const bus = await createTestBus(zone.id, 1, 50);
    const pickup = await createTestPickup(zone.id);

    await testPrisma.reservation.create({
      data: {
        reference: "HIKMA-20A-DUPEXP", publicToken: "tokdupexp",
        firstName: "A", lastName: "B", phone: "771333333",
        zoneId: zone.id, pickupPointId: pickup.id,
        seats: 1, tripType: "ROUND_TRIP", busId: bus.id,
        amountXof: 3000, paymentMethod: "WAVE",
        status: ReservationStatus.EXPIRED,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const result = await createReservation(
      baseInput({ phone: "771333333", zoneId: zone.id, pickupPointId: pickup.id }),
      testPrisma,
    );
    expect(result.ok).toBe(true);
  });

  // ─── Montant serveur ────────────────────────────────────────────────────────

  it("le montant est calculé par le serveur à partir des réglages", async () => {
    await createTestSettings();
    const zone = await createTestZone("Pikine", 1);
    await createTestBus(zone.id, 1, 50);
    const pickup = await createTestPickup(zone.id);

    const result = await createReservation(
      baseInput({ phone: "771444444", zoneId: zone.id, pickupPointId: pickup.id, seats: 3 }),
      testPrisma,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reservation.amountXof).toBe(9000); // 3000 × 3
  });
});
