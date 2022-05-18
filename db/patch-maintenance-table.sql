-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE maintenance
(
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title       VARCHAR(150),
    description TEXT,
    user_id     INTEGER REFERENCES user ON UPDATE CASCADE ON DELETE SET NULL,
    start_date  DATETIME,
    end_date    DATETIME
);

CREATE TABLE monitor_maintenance
(
    id             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    monitor_id     INTEGER NOT NULL,
    maintenance_id INTEGER NOT NULL,
    CONSTRAINT FK_maintenance FOREIGN KEY (maintenance_id) REFERENCES maintenance (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_monitor FOREIGN KEY (monitor_id) REFERENCES monitor (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE maintenance_status_page
(
    id             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    status_page_id INTEGER NOT NULL,
    maintenance_id INTEGER NOT NULL,
    CONSTRAINT FK_maintenance FOREIGN KEY (maintenance_id) REFERENCES maintenance (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_status_page FOREIGN KEY (status_page_id) REFERENCES status_page (id) ON DELETE CASCADE ON UPDATE CASCADE
);

create index maintenance_user_id on maintenance (user_id);

COMMIT;
