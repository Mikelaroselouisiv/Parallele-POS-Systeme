/** Devise par défaut du POS — gourdes haïtiennes. */
export const CURRENCY_CODE = 'HTG';
export const CURRENCY_NAME = 'gourdes';

/** Devise affichée (corrige l’ancien défaut XOF en base). */
export function resolveCurrencyCode(code?: string | null): string {
  const c = code?.trim();
  if (!c || c === 'XOF') return CURRENCY_CODE;
  return c;
}
/** Affiche un montant avec la devise (ex. « 1 250,00 HTG »). */
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const num = n.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${num} HTG`;
}

/** Affiche un montant compact pour tickets étroits (ex. « 1250,00 HTG »). */
export function formatMoneyCompact(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`;
}

/** Libellé de champ de saisie monétaire (ex. « Prix unitaire (HTG) »). */
export function moneyLabel(text: string, currency: string = CURRENCY_CODE): string {
  return `${text} (${currency})`;
}
