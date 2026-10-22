// ============================================
// SHARENOTE — SQLite database (node:sqlite, built into Node 24)
// ============================================

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data')
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'sharenote.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boards (
    id            TEXT PRIMARY KEY,
    owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unique_slug   TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    public_access TEXT NOT NULL DEFAULT 'restricted'
                  CHECK (public_access IN ('restricted', 'viewer', 'editor')),
    canvas_data   TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- People the owner invited by email; their role applies whatever public_access is
  CREATE TABLE IF NOT EXISTS board_members (
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role     TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
    added_at TEXT NOT NULL,
    PRIMARY KEY (board_id, user_id)
  );

  -- Boards a user has opened through a share link, so they show up on Home
  CREATE TABLE IF NOT EXISTS board_visits (
    board_id       TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_opened_at TEXT NOT NULL,
    PRIMARY KEY (board_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
  CREATE INDEX IF NOT EXISTS idx_messages_board ON messages(board_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_board_visits_user ON board_visits(user_id);
`)
