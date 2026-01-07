BEGIN TRANSACTION;

-- Create new table with foreign key constraint
CREATE TABLE monitor_tls_info_new (
    monitor_id INTEGER NOT NULL REFERENCES [monitor] ([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    info_json TEXT
);

-- Copy data from old table
INSERT INTO monitor_tls_info_new SELECT * FROM monitor_tls_info;

-- Drop old table
DROP TABLE monitor_tls_info;

-- Rename new table
ALTER TABLE monitor_tls_info_new RENAME TO monitor_tls_info;

COMMIT;
