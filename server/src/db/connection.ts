import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// server/data/app.db, relative to this file's location (server/src/db/connection.ts).
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "app.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id              TEXT PRIMARY KEY,   -- login.uuid from randomuser.me
    title           TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    gender          TEXT NOT NULL,
    dob             TEXT NOT NULL,      -- ISO 8601 date string
    age             INTEGER NOT NULL,
    street_number   INTEGER NOT NULL,
    street_name     TEXT NOT NULL,
    city            TEXT NOT NULL,
    state           TEXT NOT NULL,
    country         TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT NOT NULL,
    picture_thumbnail TEXT NOT NULL,
    picture_large     TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
