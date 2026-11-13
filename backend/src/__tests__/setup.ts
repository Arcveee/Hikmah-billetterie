import { beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const DB_URL = (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "")
  .replace("-pooler.", "."); // connexion directe obligatoire pour FOR UPDATE

export const testPrisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

beforeAll(async () => {
  await testPrisma.$connect();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

beforeEach(async () => {
  // Nettoyage dans l'ordre des dépendances FK
  await testPrisma.$transaction([
    testPrisma.auditLog.deleteMany(),
    testPrisma.payment.deleteMany(),
    testPrisma.webhookEvent.deleteMany(),
    testPrisma.reservation.deleteMany(),
    testPrisma.pickupPoint.deleteMany(),
    testPrisma.bus.deleteMany(),
    testPrisma.zone.deleteMany(),
    testPrisma.settings.deleteMany(),
    testPrisma.adminUser.deleteMany(),
  ]);
});
