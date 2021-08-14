-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
PRAGMA foreign_keys = off;

BEGIN TRANSACTION;

create table heartbeat_dg_tmp
(
    id INTEGER not null primary key autoincrement,
    important INTEGER default 0 not null,
    monitor_id INTEGER default 0 not null,
    status INTEGER default 0 not null,
    msg TEXT,
    time DATETIME not null,
    ping INTEGER default 0,
    duration INTEGER default 0 not null,
    http_code INTEGER default 0
);

insert into
	heartbeat_dg_tmp(
		id,
		important,
		monitor_id,
		status,
		msg,
		time,
		ping,
		duration
	)
select
	id,
	important,
	monitor_id,
	status,
	msg,
	time,
	ping,
	duration
from
	heartbeat;

drop table heartbeat;

alter table
	heartbeat_dg_tmp rename to heartbeat;

COMMIT;

PRAGMA foreign_keys = on;
