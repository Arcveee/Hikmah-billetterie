import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import prisma from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import { apiError } from "../../lib/errors";
import { requireAdmin, type AuthRequest } from "../../middleware/auth";
import { loginLimiter } from "../../middleware/rateLimits";

const router = Router();

// POST /api/admin/login
router.post("/login", loginLimiter, async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 400, "VALIDATION_ERROR", "Identifiant et mot de passe requis.");

  const admin = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
  if (!admin) return apiError(res, 401, "INVALID_CREDENTIALS", "Identifiant ou mot de passe incorrect.");

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!valid) return apiError(res, 401, "INVALID_CREDENTIALS", "Identifiant ou mot de passe incorrect.");

  const token = signToken({ adminId: admin.id, username: admin.username });
  return res.json({ token, admin: { id: admin.id, username: admin.username } });
});

// GET /api/admin/me
router.get("/me", requireAdmin, (req: AuthRequest, res) => {
  return res.json({ admin: req.admin });
});

export default router;
