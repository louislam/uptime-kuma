-- change column weight from boolean to integer in group and group_monitor tables
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS [new_group]
(
    id           INTEGER      not null
        constraint group_pk
            primary key autoincrement,
    name         VARCHAR(255) not null,
    created_date DATETIME              default (DATETIME('now')) not null,
    public       BOOLEAN               default 0 not null,
    active       BOOLEAN               default 1 not null,
    weight       INTEGER      NOT NULL DEFAULT 1000,
    status_page_id INTEGER
);

CREATE TABLE [new_monitor_group]
(
    [id]         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    [monitor_id] INTEGER                           NOT NULL REFERENCES [monitor] ([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    [group_id]   INTEGER                           NOT NULL REFERENCES [group] ([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    weight INTEGER NOT NULL DEFAULT 1000
);

INSERT INTO new_group(id, name, created_date, public, active, weight, status_page_id)
SELECT id, name, created_date, public, active, weight, status_page_id
FROM `group`;

INSERT INTO new_monitor_group(id, monitor_id, group_id, weight)
SELECT id, monitor_id, group_id, weight
FROM monitor_group;

DROP TABLE `group`;
DROP TABLE monitor_group;

ALTER TABLE new_group RENAME TO `group`;
ALTER TABLE new_monitor_group RENAME TO monitor_group;

CREATE INDEX [fk]
    ON [monitor_group] (
    [monitor_id],
    [group_id]);

COMMIT;

PRAGMA foreign_keys=on;
