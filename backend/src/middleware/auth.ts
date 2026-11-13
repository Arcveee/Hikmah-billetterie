import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt";
import { apiError } from "../lib/errors";

export interface AuthRequest extends Request {
  admin?: JwtPayload;
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    apiError(res, 401, "UNAUTHORIZED", "Authentification requise.");
    return;
  }
  try {
    req.admin = verifyToken(header.slice(7));
    next();
  } catch {
    apiError(res, 401, "INVALID_TOKEN", "Token invalide ou expiré.");
  }
}
