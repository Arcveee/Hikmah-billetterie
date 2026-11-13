import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "dev_secret_change_me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "12h";

export interface JwtPayload {
  adminId: string;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
