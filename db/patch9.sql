-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE notification
    ADD is_default BOOLEAN default 0 NOT NULL;

COMMIT;
