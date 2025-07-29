-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
CREATE TABLE tag (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	name VARCHAR(255) NOT NULL,
    color VARCHAR(255) NOT NULL,
	created_date DATETIME DEFAULT (DATETIME('now')) NOT NULL
);

CREATE TABLE monitor_tag (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	monitor_id INTEGER NOT NULL,
	tag_id INTEGER NOT NULL,
	value TEXT,
	CONSTRAINT FK_tag FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT FK_monitor FOREIGN KEY (monitor_id) REFERENCES monitor(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX monitor_tag_monitor_id_index ON monitor_tag (monitor_id);
CREATE INDEX monitor_tag_tag_id_index ON monitor_tag (tag_id);
