/** Accès SQLite (processus principal Electron) — absent dans le navigateur pur. */

export function hasLocalDb(): boolean {
  return Boolean(window.desktopApp?.localDb);
}

export async function outboxEnqueue(payload: unknown): Promise<string | null> {
  const db = window.desktopApp?.localDb;
  if (!db) return null;
  return db.outboxEnqueue(payload) as Promise<string>;
}

export async function outboxList(): Promise<Array<{ id: string; payload: unknown }>> {
  const db = window.desktopApp?.localDb;
  if (!db) return [];
  return db.outboxList() as Promise<Array<{ id: string; payload: unknown }>>;
}

export async function outboxRemove(id: string): Promise<void> {
  await window.desktopApp?.localDb?.outboxRemove(id);
}

export async function cacheSet(key: string, json: string): Promise<void> {
  await window.desktopApp?.localDb?.cacheSet(key, json);
}

export async function cacheGet(key: string): Promise<string | null> {
  const v = await window.desktopApp?.localDb?.cacheGet(key);
  return v ?? null;
}
