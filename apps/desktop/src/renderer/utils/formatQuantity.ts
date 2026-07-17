/** Affichage lisible des quantités stock (fr-FR : virgule décimale, pas de faux « 50 000 »). */
export function formatQuantity(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/** Valeur normalisée pour un champ de saisie (virgule décimale, sans zéros inutiles). */
export function formatQuantityInput(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return formatQuantity(n);
}
