CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_checked_at_id
ON heartbeats(monitor_id, checked_at DESC, id DESC);
