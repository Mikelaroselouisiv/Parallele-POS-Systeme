const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

/** @type {import('sql.js').Database | null} */
let db = null;
let dbFilePath = '';

function persist() {
  if (!db || !dbFilePath) return;
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

/**
 * @param {string} userDataPath
 */
async function initLocalDb(userDataPath) {
  dbFilePath = path.join(userDataPath, 'pos-local.sqlite');
  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    const filebuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS outbox_sales (
      id TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_cache (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  persist();
}

function outboxEnqueue(payload) {
  const id = require('crypto').randomUUID();
  db.run(
    'INSERT INTO outbox_sales (id, payload_json, created_at) VALUES (?, ?, ?)',
    [id, JSON.stringify(payload), Date.now()],
  );
  persist();
  return id;
}

function outboxList() {
  const stmt = db.prepare(
    'SELECT id, payload_json FROM outbox_sales ORDER BY created_at ASC',
  );
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({ id: r.id, payload: JSON.parse(r.payload_json) });
  }
  stmt.free();
  return rows;
}

function outboxRemove(id) {
  db.run('DELETE FROM outbox_sales WHERE id = ?', [id]);
  persist();
}

function cacheSet(key, json) {
  db.run('INSERT OR REPLACE INTO app_cache (key, value_json, updated_at) VALUES (?, ?, ?)', [
    key,
    json,
    Date.now(),
  ]);
  persist();
}

function cacheGet(key) {
  const stmt = db.prepare('SELECT value_json FROM app_cache WHERE key = ?');
  stmt.bind([key]);
  let value = null;
  if (stmt.step()) {
    value = stmt.getAsObject().value_json;
  }
  stmt.free();
  return value;
}

module.exports = {
  initLocalDb,
  outboxEnqueue,
  outboxList,
  outboxRemove,
  cacheSet,
  cacheGet,
};
