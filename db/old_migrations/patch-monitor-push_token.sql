-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD push_token VARCHAR(20) DEFAULT NULL;

COMMIT;
