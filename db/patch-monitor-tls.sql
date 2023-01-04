-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD tls_ca TEXT default null;

ALTER TABLE monitor
    ADD tls_cert TEXT default null;

ALTER TABLE monitor
    ADD tls_key TEXT default null;

COMMIT;
