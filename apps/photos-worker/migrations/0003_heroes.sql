CREATE TABLE IF NOT EXISTS heroes (
  page       TEXT PRIMARY KEY,  -- 'landing' | 'portraits' | 'landscape' | 'grad' | 'boudoir'
  photo_id   TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
