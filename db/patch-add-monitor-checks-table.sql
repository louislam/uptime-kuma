-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

-- Create new monitor_checks table
create table monitor_checks
(
    id         INTEGER
                    constraint monitor_checks_pk
                    primary key autoincrement,
    type       VARCHAR(50) not null,
    value      TEXTt,
    monitor_id INTEGER     not null
                    constraint monitor_checks_monitor_id_fk
                        references monitor
                        on update cascade on delete cascade
);

insert into monitor_checks(id, type, value, monitor_id)
select id, type, value, monitor_id
from monitor_checks;

create unique index monitor_checks_id_uindex
    on monitor_checks (id);


-- Copy over the http status to the new monitor_checks table as a separate check
insert into monitor_checks(monitor_id, type, value)
select id, 'HTTP_STATUS_CODE_SHOULD_EQUAL', accepted_statuscodes_json
from monitor;

-- Copy over the keyword column from the monitor table to the new monitor_checks table as a separate check
insert into monitor_checks(monitor_id, type, value)
select id, 'RESPONSE_SHOULD_CONTAIN', keyword
from monitor;

-- Delete the http status and keyword columns from the monitor table
create table monitor_dg_tmp
(
    id                 INTEGER not null
        primary key autoincrement,
    name               VARCHAR(150),
    active             BOOLEAN  default 1 not null,
    user_id            INTEGER
                               references user
                                   on update cascade on delete set null,
    interval           INTEGER  default 20 not null,
    url                TEXT,
    type               VARCHAR(20),
    weight             INTEGER  default 2000,
    hostname           VARCHAR(255),
    port               INTEGER,
    created_date       DATETIME default (DATETIME('now')) not null,
    maxretries         INTEGER  default 0 not null,
    ignore_tls         BOOLEAN  default 0 not null,
    upside_down        BOOLEAN  default 0 not null,
    maxredirects       INTEGER  default 10 not null,
    dns_resolve_type   VARCHAR(5),
    dns_resolve_server VARCHAR(255),
    dns_last_result    VARCHAR(255)
);

insert into monitor_dg_tmp(id, name, active, user_id, interval, url, type, weight, hostname, port, created_date, maxretries, ignore_tls, upside_down,
                           maxredirects, dns_resolve_type, dns_resolve_server, dns_last_result)
select id,
       name,
       active,
       user_id,
       interval,
       url,
       type,
       weight,
       hostname,
       port,
       created_date,
       maxretries,
       ignore_tls,
       upside_down,
       maxredirects,
       dns_resolve_type,
       dns_resolve_server,
       dns_last_result
from monitor;

drop table monitor;

alter table monitor_dg_tmp
    rename to monitor;

create index user_id
    on monitor (user_id);
COMMIT;
