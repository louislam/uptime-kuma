-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
	ADD json_path TEXT;

ALTER TABLE monitor
	ADD expected_value VARCHAR(255);

COMMIT;
