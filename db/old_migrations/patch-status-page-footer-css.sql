-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE status_page
    ADD footer_text TEXT;
ALTER TABLE status_page
    ADD custom_css TEXT;
ALTER TABLE status_page
    ADD show_powered_by BOOLEAN NOT NULL DEFAULT 1;

COMMIT;
