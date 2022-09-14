-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD dns_resolver VARCHAR(255);

ALTER TABLE monitor
    ADD custom_resolver BOOLEAN DEFAULT 0 NOT NULL;

COMMIT;