import { randomBytes } from "crypto";

// Alphabet sans caractères ambigus : pas de 0, O, 1, I
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateReference(): string {
  const bytes = randomBytes(6);
  let result = "";
  for (const byte of bytes) {
    result += ALPHABET[byte % ALPHABET.length];
  }
  return `HIKMA-20A-${result}`;
}

export function generatePublicToken(): string {
  return randomBytes(16).toString("hex"); // 128 bits
}
