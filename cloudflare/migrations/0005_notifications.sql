CREATE TABLE IF NOT EXISTS notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER,
    is_default INTEGER NOT NULL DEFAULT 0,
    config TEXT
);

CREATE TABLE IF NOT EXISTS monitor_notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    notification_id INTEGER NOT NULL,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (notification_id) REFERENCES notification(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS monitor_notification_index ON monitor_notification(monitor_id, notification_id);
