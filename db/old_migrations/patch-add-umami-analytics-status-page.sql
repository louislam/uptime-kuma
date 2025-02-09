-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE status_page
    ADD umami_analytics_domain_url VARCHAR;

ALTER TABLE status_page
ADD umami_analytics_website_id VARCHAR;

COMMIT;
