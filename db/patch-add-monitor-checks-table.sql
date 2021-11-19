-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

-- Create new monitor_checks table
create table monitor_checks
(
    id           INTEGER
                    constraint monitor_checks_pk
                    primary key autoincrement,
    type         VARCHAR(50) not null,
    value        TEXT,
    monitor_id   INTEGER NOT NULL,
                    CONSTRAINT "monitor_checks_monitor_id_fk"
                        FOREIGN KEY ("monitor_id")
                            REFERENCES "monitor" ("id")
                            ON DELETE CASCADE ON UPDATE CASCADE
);

create unique index monitor_checks_id_uindex
    on monitor_checks (id);


-- Copy over the http status to the new monitor_checks table as a separate check
insert into monitor_checks(monitor_id, type, value)
select id, 'HTTP_STATUS_CODE_SHOULD_EQUAL', accepted_statuscodes_json
from monitor;

-- Copy over the keyword column from the monitor table to the new monitor_checks table as a separate check
insert into monitor_checks(monitor_id, type, value)
select id, 'RESPONSE_SHOULD_CONTAIN_TEXT', keyword
from monitor
WHERE monitor.type = 'keyword';

-- Delete the http status and keyword columns from the monitor table
ALTER TABLE monitor DROP COLUMN accepted_statuscodes_json;
ALTER TABLE monitor DROP COLUMN keyword;

UPDATE monitor SET type = 'http' WHERE type = 'keyword';

COMMIT;


