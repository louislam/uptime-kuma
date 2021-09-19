-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

create table incident
(
    id INTEGER not null
        constraint incident_pk
            primary key autoincrement,
    title VARCHAR(255) not null,
    content TEXT not null,
    style VARCHAR(30) default 'warning' not null,
    created_date DATETIME default (DATETIME('now')) not null,
    last_updated_date DATETIME,
    pin BOOLEAN default 1 not null,
    active BOOLEAN default 1 not null
);

COMMIT;
