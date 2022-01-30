-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE dependent_monitors
(
    id             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    monitor_id     INTEGER NOT NULL,
    depends_on     INTEGER NOT NULL,
    CONSTRAINT FK_monitor_depends_on FOREIGN KEY (depends_on) REFERENCES monitor (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_monitor_id FOREIGN KEY (monitor_id) REFERENCES monitor (id) ON DELETE CASCADE ON UPDATE CASCADE
);

COMMIT;
