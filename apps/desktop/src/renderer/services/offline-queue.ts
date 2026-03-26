import type { CreateSalePayload } from '../types/api';
import { createSale } from './api';

const QUEUE_KEY = 'offline_sales_queue';

export function enqueueSale(payload: CreateSalePayload) {
  const queue = readQueue();
  queue.push(payload);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function syncSalesQueue() {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0 };
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
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced, pending: remaining.length };
}

function readQueue(): CreateSalePayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CreateSalePayload[];
  } catch {
    return [];
  }
}
