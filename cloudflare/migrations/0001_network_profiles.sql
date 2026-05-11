CREATE TABLE IF NOT EXISTS network_profiles (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT,
    hostname TEXT,
    port INTEGER,
    method TEXT DEFAULT 'GET',
    headers TEXT,
    body TEXT,
    keyword TEXT,
    invert_keyword INTEGER NOT NULL DEFAULT 0,
    json_path TEXT,
    expected_value TEXT,
    timeout INTEGER NOT NULL DEFAULT 30,
    interval INTEGER NOT NULL DEFAULT 60,
    active INTEGER NOT NULL DEFAULT 1,
    network_profile_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (network_profile_id) REFERENCES network_profiles(id)
);

CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    ping INTEGER,
    msg TEXT,
    response_r2_key TEXT,
    checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id)
);

CREATE INDEX IF NOT EXISTS idx_monitors_active_interval ON monitors(active, interval);
CREATE INDEX IF NOT EXISTS idx_monitors_network_profile ON monitors(network_profile_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_checked_at ON heartbeats(monitor_id, checked_at DESC);

INSERT OR IGNORE INTO network_profiles (id, slug, name, type, enabled)
VALUES ('twingate', 'twingate', 'Twingate', 'twingate', 1);
