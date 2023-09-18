-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE status_page
    ADD google_analytics_tag_id VARCHAR;

COMMIT;
