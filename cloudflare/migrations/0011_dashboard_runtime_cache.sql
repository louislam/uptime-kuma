CREATE TABLE IF NOT EXISTS monitor_runtime_summary (
    monitor_id INTEGER PRIMARY KEY,
    latest_heartbeat_id INTEGER,
    status INTEGER,
    ping INTEGER,
    msg TEXT,
    checked_at TEXT,
    avg_ping REAL,
    uptime_24 REAL,
    uptime_720 REAL,
    uptime_1y REAL,
    heartbeat_bar_json TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (latest_heartbeat_id) REFERENCES heartbeats(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS monitor_event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    heartbeat_id INTEGER NOT NULL UNIQUE,
    monitor_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    ping INTEGER,
    msg TEXT,
    checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (heartbeat_id) REFERENCES heartbeats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitor_event_log_checked_at
ON monitor_event_log(checked_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_monitor_event_log_monitor_checked_at
ON monitor_event_log(monitor_id, checked_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS monitor_metric_bucket (
    monitor_id INTEGER NOT NULL,
    resolution_seconds INTEGER NOT NULL,
    bucket_start TEXT NOT NULL,
    up_count INTEGER NOT NULL DEFAULT 0,
    down_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    maintenance_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    ping_sum REAL NOT NULL DEFAULT 0,
    min_ping REAL,
    max_ping REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (monitor_id, resolution_seconds, bucket_start),
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitor_metric_bucket_lookup
ON monitor_metric_bucket(monitor_id, resolution_seconds, bucket_start);
