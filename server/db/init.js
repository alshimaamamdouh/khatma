const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function initDB() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS khatma (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      start_date  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS participants (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      khatma_id   INTEGER NOT NULL,
      name        TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      FOREIGN KEY (khatma_id) REFERENCES khatma(id) ON DELETE CASCADE,
      UNIQUE(khatma_id, slot_number)
    )`,
    `CREATE TABLE IF NOT EXISTS deceased (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      khatma_id   INTEGER NOT NULL,
      name        TEXT NOT NULL,
      death_date  TEXT NOT NULL,
      FOREIGN KEY (khatma_id) REFERENCES khatma(id) ON DELETE CASCADE
    )`
  ]);
}

module.exports = { db, initDB };
