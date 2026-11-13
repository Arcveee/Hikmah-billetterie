import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  datasources: {
    db: {
      // Utilise DIRECT_URL si disponible (requis pour SELECT FOR UPDATE sur Neon)
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
});

export default prisma;
