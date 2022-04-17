-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE heartbeat
    ADD last_notified_time DATETIME default null;

COMMIT;
