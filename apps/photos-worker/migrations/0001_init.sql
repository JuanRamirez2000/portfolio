CREATE TABLE IF NOT EXISTS photos (
  id          TEXT PRIMARY KEY,        -- Cloudflare Images UUID
  filename    TEXT NOT NULL,
  gallery     TEXT NOT NULL,
  ratio       TEXT NOT NULL DEFAULT 'tall', -- 'tall' | 'wide' | 'square'
  title       TEXT NOT NULL DEFAULT '',
  alt         TEXT NOT NULL DEFAULT '',
  year        INTEGER NOT NULL,
  featured    INTEGER NOT NULL DEFAULT 0,  -- 0 | 1
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_gallery ON photos(gallery);
CREATE INDEX IF NOT EXISTS idx_photos_featured ON photos(featured);
