-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE docker_host (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	user_id INT NOT NULL,
	docker_daemon VARCHAR(255),
	docker_type VARCHAR(255),
	name VARCHAR(255)
);

ALTER TABLE monitor
	ADD docker_host INTEGER REFERENCES docker_host(id);

ALTER TABLE monitor
	ADD docker_container VARCHAR(255);

COMMIT;
