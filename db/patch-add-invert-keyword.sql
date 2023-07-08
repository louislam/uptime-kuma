-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD invert_keyword BOOLEAN default 0 not null;

COMMIT;
