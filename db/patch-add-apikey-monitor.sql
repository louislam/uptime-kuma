-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD apikey VARCHAR(64) default '' not null;

COMMIT;
