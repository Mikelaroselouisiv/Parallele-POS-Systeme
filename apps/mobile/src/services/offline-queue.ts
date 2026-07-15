import * as Crypto from 'expo-crypto';
import type { CreateSalePayload } from '../types/api';
import { createSale } from './api';
import { getDb } from './db';

function ensureClientUuid(payload: CreateSalePayload): CreateSalePayload {
  if (payload.clientUuid) return payload;
  return { ...payload, clientUuid: Crypto.randomUUID() };
}

export async function enqueueSale(payload: CreateSalePayload): Promise<void> {
  const withUuid = ensureClientUuid(payload);
  await getDb().runAsync(
    'INSERT INTO outbox_sales (id, payload_json, created_at) VALUES (?, ?, ?)',
    withUuid.clientUuid!,
    JSON.stringify(withUuid),
    Date.now(),
  );
}

/** Rejoue la file dans l'ordre — s'arrête à la première erreur (préserve l'ordre, pas de saut). */
export async function syncSalesQueue(): Promise<{ synced: number; pending: number }> {
  const rows = await getDb().getAllAsync<{ id: string; payload_json: string }>(
    'SELECT id, payload_json FROM outbox_sales ORDER BY created_at ASC',
  );
  let synced = 0;
  for (const row of rows) {
    try {
      const payload = ensureClientUuid(JSON.parse(row.payload_json) as CreateSalePayload);
      await createSale(payload);
      await getDb().runAsync('DELETE FROM outbox_sales WHERE id = ?', row.id);
      synced += 1;
    } catch {
      break;
    }
  }
  const pending = (await getDb().getAllAsync('SELECT id FROM outbox_sales')).length;
  return { synced, pending };
}

export async function pendingSalesCount(): Promise<number> {
  return (await getDb().getAllAsync('SELECT id FROM outbox_sales')).length;
}
