-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD method TEXT default 'GET' not null;

ALTER TABLE monitor
    ADD body TEXT default null;

ALTER TABLE monitor
    ADD headers TEXT default null;

COMMIT;
