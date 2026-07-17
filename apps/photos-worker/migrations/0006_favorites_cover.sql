ALTER TABLE client_galleries ADD COLUMN cover_photo_id TEXT;

CREATE TABLE client_photo_favorites (
  gallery_id TEXT NOT NULL,
  photo_id   TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (gallery_id, photo_id),
  FOREIGN KEY (gallery_id) REFERENCES client_galleries(id) ON DELETE CASCADE
);
