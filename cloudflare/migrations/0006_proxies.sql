CREATE TABLE IF NOT EXISTS proxy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    protocol TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    auth INTEGER NOT NULL DEFAULT 0,
    username TEXT,
    password TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    "default" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proxy_default ON proxy("default");

ALTER TABLE monitors ADD COLUMN proxy_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_monitors_proxy_id ON monitors(proxy_id);
