-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

-- For sendHeartbeatList
CREATE INDEX monitor_time_index ON heartbeat (monitor_id, time);

-- For sendImportantHeartbeatList
CREATE INDEX monitor_important_time_index ON heartbeat (monitor_id, important,time);

COMMIT;
