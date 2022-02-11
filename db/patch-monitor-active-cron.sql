-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD cron VARCHAR(99) DEFAULT NULL;

COMMIT;
