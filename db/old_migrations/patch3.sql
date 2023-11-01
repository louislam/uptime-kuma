-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
-- Add maxretries column to monitor
PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

create table monitor_dg_tmp
(
    id INTEGER not null
        primary key autoincrement,
    name VARCHAR(150),
    active BOOLEAN default 1 not null,
    user_id INTEGER
        references user
                   on update cascade on delete set null,
    interval INTEGER default 20 not null,
    url TEXT,
    type VARCHAR(20),
    weight INTEGER default 2000,
    hostname VARCHAR(255),
    port INTEGER,
    created_date DATETIME,
    keyword VARCHAR(255),
    maxretries INTEGER NOT NULL DEFAULT 0
);

insert into monitor_dg_tmp(id, name, active, user_id, interval, url, type, weight, hostname, port, created_date, keyword) select id, name, active, user_id, interval, url, type, weight, hostname, port, created_date, keyword from monitor;

drop table monitor;

alter table monitor_dg_tmp rename to monitor;

create index user_id on monitor (user_id);

COMMIT;

PRAGMA foreign_keys=on;
