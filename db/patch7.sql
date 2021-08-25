-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
	ADD dns_resolve_type VARCHAR(5);

ALTER TABLE monitor
	ADD dns_resolve_server VARCHAR(255);

COMMIT;
