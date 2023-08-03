-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;
ALTER TABLE status_page ADD show_locale_selector BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE status_page ADD default_locale TEXT DEFAULT "";
COMMIT;
