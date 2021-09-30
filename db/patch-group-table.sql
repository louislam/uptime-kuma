-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

create table `group`
(
    id           INTEGER      not null
        constraint group_pk
            primary key autoincrement,
    name         VARCHAR(255) not null,
    created_date DATETIME              default (DATETIME('now')) not null,
    public       BOOLEAN               default 0 not null,
    active       BOOLEAN               default 1 not null,
    weight       BOOLEAN      NOT NULL DEFAULT 1000
);

CREATE TABLE [monitor_group]
(
    [id]         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    [monitor_id] INTEGER                           NOT NULL REFERENCES [monitor] ([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    [group_id]   INTEGER                           NOT NULL REFERENCES [group] ([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    weight BOOLEAN NOT NULL DEFAULT 1000
);

CREATE INDEX [fk]
    ON [monitor_group] (
                        [monitor_id],
                        [group_id]);


COMMIT;
