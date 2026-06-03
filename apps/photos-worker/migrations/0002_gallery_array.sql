-- Recreate photos table with galleries as a JSON array TEXT column
-- (safe since table has no data yet)
DROP TABLE IF EXISTS photos;

CREATE TABLE photos (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  galleries   TEXT NOT NULL DEFAULT '[]',  -- JSON array e.g. '["portraits","landscape"]'
  ratio       TEXT NOT NULL DEFAULT 'tall',
  title       TEXT NOT NULL DEFAULT '',
  alt         TEXT NOT NULL DEFAULT '',
  year        INTEGER NOT NULL,
  featured    INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_featured ON photos(featured);
