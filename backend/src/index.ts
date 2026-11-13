import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import logger from "./logger";
import healthRouter from "./routes/health";
import publicRouter from "./routes/public";
import adminAuthRouter from "./routes/admin/auth";
import adminStatsRouter from "./routes/admin/stats";
import adminZonesRouter from "./routes/admin/zones";
import adminBusesRouter from "./routes/admin/buses";
import adminReservationsRouter from "./routes/admin/reservations";
import adminSettingsRouter from "./routes/admin/settings";
import adminExportsRouter from "./routes/admin/exports";
import ticketsRouter from "./routes/tickets";
import webhooksRouter from "./routes/webhooks";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
// Webhook AVANT express.json() — raw body requis
app.use("/api", webhooksRouter);

app.use(express.json({ limit: "50kb" }));

app.use("/api", healthRouter);
app.use("/api", publicRouter);
app.use("/api/admin", adminAuthRouter);
app.use("/api/admin", adminStatsRouter);
app.use("/api/admin", adminZonesRouter);
app.use("/api/admin", adminBusesRouter);
app.use("/api/admin", adminReservationsRouter);
app.use("/api/admin", adminSettingsRouter);
app.use("/api/admin", adminExportsRouter);
app.use("/api", ticketsRouter);

app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue." },
    });
  },
);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Backend démarré");
});

export default app;
