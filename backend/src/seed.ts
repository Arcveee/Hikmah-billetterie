import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

if (process.env.NODE_ENV !== "development") {
  console.error("db:seed ne s'exécute qu'en NODE_ENV=development");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  // Settings
  await prisma.settings.upsert({
    where: { singleton: true },
    update: {
      eventName: "20 ans de Hikma — La Maison de la Sagesse",
      eventDate: new Date("2025-06-15T08:00:00.000Z"),
      venue: "Dakar Arena, Diamniadio",
      priceRoundTripXof: 3000,
      priceOneWayXof: 2000,
      lockMinutes: 15,
      maxSeatsPerOrder: 6,
      whatsappContact: "+221772142020",
    },
    create: {
      singleton: true,
      eventName: "20 ans de Hikma — La Maison de la Sagesse",
      eventDate: new Date("2025-06-15T08:00:00.000Z"),
      venue: "Dakar Arena, Diamniadio",
      priceRoundTripXof: 3000,
      priceOneWayXof: 2000,
      lockMinutes: 15,
      maxSeatsPerOrder: 6,
      whatsappContact: "+221772142020",
    },
  });

  // Zones
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { name: "Pikine" },
      update: {},
      create: { name: "Pikine", displayOrder: 1 },
    }),
    prisma.zone.upsert({
      where: { name: "Mbao" },
      update: {},
      create: { name: "Mbao", displayOrder: 2 },
    }),
    prisma.zone.upsert({
      where: { name: "Bouguiba" },
      update: {},
      create: { name: "Bouguiba", displayOrder: 3 },
    }),
  ]);

  // 3 bus par zone
  for (const zone of zones) {
    for (let n = 1; n <= 3; n++) {
      const existing = await prisma.bus.findUnique({
        where: { zoneId_number: { zoneId: zone.id, number: n } },
      });
      if (!existing) {
        await prisma.bus.create({
          data: {
            zoneId: zone.id,
            number: n,
            label: `${zone.name} · Bus ${n}`,
            capacity: 50,
            isOpen: true,
            departureTime: "08:30",
            arrivalTime: "09:30",
            returnTime: "18:00",
            returnLocation: "Point de départ",
          },
        });
      }
    }
  }

  // Points de ramassage
  const pickupData: { zone: string; points: string[] }[] = [
    { zone: "Pikine", points: ["Pikine Tally Boumack", "Pikine Icotaf", "Thiaroye Gare"] },
    { zone: "Mbao", points: ["Mbao Marché", "Keur Massar", "Yeumbeul Nord"] },
    { zone: "Bouguiba", points: ["Bouguiba Centre", "Liberté 6", "Patte d'Oie"] },
  ];

  for (const { zone: zoneName, points } of pickupData) {
    const zone = zones.find((z) => z.name === zoneName)!;
    for (const name of points) {
      const existing = await prisma.pickupPoint.findFirst({
        where: { zoneId: zone.id, name },
      });
      if (!existing) {
        await prisma.pickupPoint.create({ data: { zoneId: zone.id, name } });
      }
    }
  }

  // Compte admin
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "hikma2025dev";
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
