import type { Response } from "express";

export function apiError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

/** Safely extract a string param from req.params (handles string | string[]) */
export function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}
