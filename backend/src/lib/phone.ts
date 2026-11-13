const PHONE_RE = /^(70|75|76|77|78)\d{7}$/;

/** Normalise vers 9 chiffres : accepte espaces, +221, 00221 */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/\s/g, "");
  if (s.startsWith("+221")) s = s.slice(4);
  else if (s.startsWith("00221")) s = s.slice(5);
  return PHONE_RE.test(s) ? s : null;
}
