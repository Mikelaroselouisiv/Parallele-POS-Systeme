/** Normalise le numéro pour stockage et comparaison (trim, espaces internes). */
export function normalizePhone(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}
