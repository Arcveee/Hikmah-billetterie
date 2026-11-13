import express, { Router } from "express";
import prisma from "../lib/prisma";
import { verifyWebhookSignature } from "../lib/payment";
import { ReservationStatus, PaymentStatus } from "@prisma/client";
import logger from "../logger";

const router = Router();

// POST /api/webhooks/bictorys — monté AVANT express.json() dans index.ts
router.post(
  "/webhooks/bictorys",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["x-bictorys-signature"] as string | undefined;
    const rawBody = (req.body as Buffer).toString("utf8");

    if (!sig || !verifyWebhookSignature(rawBody, sig)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let event: { id?: string; type: string; data: { metadata?: { reservationId?: string } } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const eventId = event.id ?? rawBody.slice(0, 64);

    // Idempotence
    try {
      await prisma.webhookEvent.create({ data: { provider: "bictorys", eventId } });
    } catch {
      return res.json({ received: true, duplicate: true });
    }

    if (event.type === "charge.completed") {
      const reservationId = event.data.metadata?.reservationId;
      if (reservationId) {
        await prisma.$transaction([
          prisma.reservation.updateMany({
            where: { id: reservationId, status: ReservationStatus.PENDING },
            data: { status: ReservationStatus.PAID, paidAt: new Date() },
          }),
          prisma.payment.updateMany({
            where: { reservationId, provider: "bictorys" },
            data: { status: PaymentStatus.SUCCEEDED },
          }),
        ]);
        logger.info({ reservationId }, "Paiement confirmé via webhook Bictorys");
      }
    }

    return res.json({ received: true });
  },
);

export default router;
