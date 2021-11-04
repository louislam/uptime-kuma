-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
	ADD topic VARCHAR(50);

ALTER TABLE monitor
	ADD success_message VARCHAR(255);

COMMIT;
