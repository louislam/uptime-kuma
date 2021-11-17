-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
	ADD mqtt_topic VARCHAR(50);

ALTER TABLE monitor
	ADD mqtt_success_message VARCHAR(255);

ALTER TABLE monitor
	ADD mqtt_port NUMBER(10);

ALTER TABLE monitor
	ADD mqtt_username VARCHAR(255);

ALTER TABLE monitor
	ADD mqtt_password VARCHAR(255);

COMMIT;
