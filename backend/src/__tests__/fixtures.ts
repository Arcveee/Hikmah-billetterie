import { TripType, PaymentMethod } from "@prisma/client";
import { testPrisma } from "./setup";

export async function createTestSettings() {
  return testPrisma.settings.upsert({
    where: { singleton: true },
    update: {},
    create: {
      singleton: true,
      eventName: "Test Event",
      eventDate: new Date("2025-06-15"),
      venue: "Test Venue",
      priceRoundTripXof: 3000,
      priceOneWayXof: 2000,
      lockMinutes: 15,
      maxSeatsPerOrder: 6,
      whatsappContact: "+221770000000",
    },
  });
}

export async function createTestZone(name: string, order = 1) {
  return testPrisma.zone.create({ data: { name, displayOrder: order } });
}

export async function createTestBus(
  zoneId: string,
  number: number,
  capacity: number,
  isOpen = true,
) {
  return testPrisma.bus.create({
    data: {
      zoneId,
      number,
      label: `Zone · Bus ${number}`,
      capacity,
      isOpen,
      departureTime: "08:30",
      arrivalTime: "09:30",
    },
  });
}

export async function createTestPickup(zoneId: string, name = "Arrêt Test") {
  return testPrisma.pickupPoint.create({ data: { zoneId, name } });
}

export function baseInput(overrides: Partial<{
  phone: string;
  zoneId: string;
  pickupPointId: string;
  seats: number;
  tripType: TripType;
  paymentMethod: PaymentMethod;
  acknowledgeDuplicate: boolean;
}> = {}) {
  return {
    firstName: "Aminata",
    lastName: "Diallo",
    phone: "771234567",
    zoneId: "",
    pickupPointId: "",
    seats: 1,
    tripType: TripType.ROUND_TRIP,
    paymentMethod: PaymentMethod.WAVE,
    ...overrides,
  };
}
