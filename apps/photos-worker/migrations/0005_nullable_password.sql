-- SQLite can't ALTER COLUMN, so recreate the table with password_hash nullable
PRAGMA foreign_keys=off;

CREATE TABLE client_galleries_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO client_galleries_new SELECT * FROM client_galleries;
DROP TABLE client_galleries;
ALTER TABLE client_galleries_new RENAME TO client_galleries;

PRAGMA foreign_keys=on;
