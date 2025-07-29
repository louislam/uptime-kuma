-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE user
    ADD twofa_secret VARCHAR(64);

ALTER TABLE user
    ADD twofa_status BOOLEAN default 0 NOT NULL;

COMMIT;
