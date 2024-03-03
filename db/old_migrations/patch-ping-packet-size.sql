-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD packet_size INTEGER DEFAULT 56 NOT NULL;

COMMIT;
