CREATE TABLE client_galleries (
  id          TEXT PRIMARY KEY,           -- slug, e.g. "emma-2024"
  name        TEXT NOT NULL,              -- display name, e.g. "Emma's Session"
  password_hash TEXT NOT NULL,            -- SHA-256 hex of password
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE client_photos (
  id          TEXT PRIMARY KEY,           -- CF Images ID
  gallery_id  TEXT NOT NULL REFERENCES client_galleries(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_client_photos_gallery ON client_photos(gallery_id);
