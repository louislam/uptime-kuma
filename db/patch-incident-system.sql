-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

create table incident_dg_tmp
(
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    type VARCHAR(30) DEFAULT 'started' NOT NULL,
    style VARCHAR(30) DEFAULT 'info',
    title VARCHAR(255),
    description TEXT NOT NULL,
    user_id INTEGER references user on update cascade on delete set null DEFAULT 1,
    override_status BOOLEAN DEFAULT 0 NOT NULL,
    status VARCHAR(50),
    created_date DATETIME DEFAULT (DATETIME('now')) NOT NULL,
    parent_incident INTEGER,
    resolved BOOLEAN DEFAULT 0 NOT NULL,
    resolved_date DATETIME
);

insert into incident_dg_tmp(id, title, description, created_date) select id, title, content, created_date from incident;

drop table incident;

alter table incident_dg_tmp rename to incident;

create index incident_user_id on incident (user_id);

CREATE TABLE monitor_incident
(
    id             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    monitor_id     INTEGER NOT NULL,
    incident_id    INTEGER NOT NULL,
    CONSTRAINT FK_incident FOREIGN KEY (incident_id) REFERENCES incident (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_monitor FOREIGN KEY (monitor_id) REFERENCES monitor (id) ON DELETE CASCADE ON UPDATE CASCADE
);

COMMIT;
