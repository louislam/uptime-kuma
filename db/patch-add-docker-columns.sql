-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
	ADD docker_daemon VARCHAR(255);

ALTER TABLE monitor
	ADD docker_container VARCHAR(255);

ALTER TABLE monitor
	ADD docker_type VARCHAR(255);

COMMIT;
