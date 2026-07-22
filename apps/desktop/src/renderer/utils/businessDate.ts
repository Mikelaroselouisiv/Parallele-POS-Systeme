/** Fuseau métier unique du POS — aligné avec le backend (`America/Port-au-Prince`). */
export const BUSINESS_TIME_ZONE = 'America/Port-au-Prince';

/** Jour calendaire métier (YYYY-MM-DD), pas le TZ de la machine. */
export function formatBusinessYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Premier jour du mois calendaire métier courant. */
export function defaultMonthStartYmdBusiness(now: Date = new Date()): string {
  const ymd = formatBusinessYmd(now);
  return `${ymd.slice(0, 8)}01`;
}

/** Date-heure lisible en fuseau Haïti (JJ/MM/AAAA HH:mm). */
export function formatBusinessDateTime(value: Date | string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}
