-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD gamedig_given_port_only BOOLEAN default 1 not null;

COMMIT;
