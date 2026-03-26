const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'khatma.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS khatma (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    access_code TEXT NOT NULL UNIQUE,
    start_date  TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS participants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    khatma_id   INTEGER NOT NULL,
    name        TEXT NOT NULL,
    slot_number INTEGER NOT NULL,
    FOREIGN KEY (khatma_id) REFERENCES khatma(id) ON DELETE CASCADE,
    UNIQUE(khatma_id, slot_number)
  );

  CREATE TABLE IF NOT EXISTS deceased (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    khatma_id   INTEGER NOT NULL,
    name        TEXT NOT NULL,
    death_date  TEXT NOT NULL,
    FOREIGN KEY (khatma_id) REFERENCES khatma(id) ON DELETE CASCADE
  );
`);

module.exports = db;
