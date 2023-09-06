-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE monitor_tls_info (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	monitor_id INTEGER NOT NULL,
	info_json TEXT
);

COMMIT;
