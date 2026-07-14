import axios from 'axios';
import { ENTITY_ORDER } from './entities.js';

export function createApiClient(baseURL, syncKey) {
  return axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    timeout: 60_000,
    headers: {
      'X-Sync-Key': syncKey,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Pull deltas from `from` and push them to `to`.
 * Cursors kept in memory (+ optional file later via SyncState API).
 */
export async function replicateDirection({
  from,
  to,
  cursors,
  sourceNodeId,
  label,
}) {
  const summary = { label, entities: {} };

  for (const entity of ENTITY_ORDER) {
    let since = cursors[entity] || '1970-01-01T00:00:00.000Z';
    let pulled = 0;
    let applied = 0;
    let pages = 0;

    for (;;) {
      pages += 1;
      const { data } = await from.get('/sync/pull', {
        params: { entity, since, take: 200 },
      });
      const records = data.records || [];
      if (records.length === 0) {
        if (data.nextCursor) cursors[entity] = data.nextCursor;
        break;
      }

      pulled += records.length;
      const pushRes = await to.post('/sync/push', {
        entity,
        sourceNodeId,
        records,
      });
      applied += pushRes.data?.applied ?? 0;
      since = data.nextCursor || records[records.length - 1]?.updatedAt || since;
      cursors[entity] = since;

      if (records.length < 200 || pages > 50) break;
    }

    summary.entities[entity] = { pulled, applied, cursor: cursors[entity] };
  }

  return summary;
}
