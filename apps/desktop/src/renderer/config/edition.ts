export type AppEdition = 'server' | 'remote';

/** Build flavor : `VITE_APP_EDITION=server|remote` (défaut dev → server, prod sans flavor → remote). */
export function getAppEdition(): AppEdition {
  const edition = import.meta.env.VITE_APP_EDITION?.trim().toLowerCase();
  if (edition === 'server' || edition === 'remote') return edition;
  if (import.meta.env.DEV) return 'server';
  return 'remote';
}

export function isServerEdition(): boolean {
  return getAppEdition() === 'server';
}

export function isRemoteEdition(): boolean {
  return getAppEdition() === 'remote';
}
