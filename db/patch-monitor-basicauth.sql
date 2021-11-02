-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD basicauth_user TEXT default null;

ALTER TABLE monitor
    ADD basicauth_pass TEXT default null;

COMMIT;
