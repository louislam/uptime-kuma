-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD sip_basic_auth_user TEXT default null;

ALTER TABLE monitor
    ADD sip_basic_auth_pass TEXT default null;


COMMIT;
