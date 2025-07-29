-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE status_page
    ADD show_certificate_expiry BOOLEAN default 0 NOT NULL;

COMMIT;
