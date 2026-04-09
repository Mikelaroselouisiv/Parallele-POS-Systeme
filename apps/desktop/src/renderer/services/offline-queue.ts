import type { CreateSalePayload } from '../types/api';
import { createSale } from './api';
import * as localDb from './local-db-bridge';

const LEGACY_QUEUE_KEY = 'offline_sales_queue';

/** Migration one-shot : ancienne file localStorage → SQLite. */
function migrateLegacyQueue() {
  if (typeof localStorage === 'undefined' || !localDb.hasLocalDb()) return;
  const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
  if (!raw) return;
  try {
    const items = JSON.parse(raw) as CreateSalePayload[];
    for (const item of items) {
      void localDb.outboxEnqueue(item);
    }
    localStorage.removeItem(LEGACY_QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

export async function enqueueSale(payload: CreateSalePayload) {
  migrateLegacyQueue();
  if (localDb.hasLocalDb()) {
    await localDb.outboxEnqueue(payload);
    return;
  }
  const queue = readLegacyQueue();
  queue.push(payload);
  localStorage.setItem(LEGACY_QUEUE_KEY, JSON.stringify(queue));
}

export async function syncSalesQueue() {
  migrateLegacyQueue();
  if (localDb.hasLocalDb()) {
    const rows = await localDb.outboxList();
    if (rows.length === 0) return { synced: 0, pending: 0 };
    let synced = 0;
    for (const row of rows) {
      try {
        await createSale(row.payload as CreateSalePayload);
        await localDb.outboxRemove(row.id);
        synced += 1;
      } catch {
        break;
      }
    }
    const pending = (await localDb.outboxList()).length;
    return { synced, pending };
  }

  const queue = readLegacyQueue();
  if (queue.length === 0) return { synced: 0, pending: 0 };
  let synced = 0;
  const remaining: CreateSalePayload[] = [];
  for (const item of queue) {
    try {
      await createSale(item);
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(LEGACY_QUEUE_KEY, JSON.stringify(remaining));
  return { synced, pending: remaining.length };
}

export async function pendingSalesCount(): Promise<number> {
  migrateLegacyQueue();
  if (localDb.hasLocalDb()) {
    return (await localDb.outboxList()).length;
  }
  return readLegacyQueue().length;
}

function readLegacyQueue(): CreateSalePayload[] {
  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CreateSalePayload[];
  } catch {
    return [];
  }
}
