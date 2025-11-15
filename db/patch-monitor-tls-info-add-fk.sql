BEGIN TRANSACTION;

PRAGMA writable_schema = TRUE;

UPDATE
	SQLITE_MASTER
SET
	sql = replace(sql,
	'monitor_id INTEGER NOT NULL',
	'monitor_id INTEGER NOT NULL REFERENCES [monitor] ([id]) ON DELETE CASCADE ON UPDATE CASCADE'
)
WHERE
	name = 'monitor_tls_info'
	AND type = 'table';

PRAGMA writable_schema = RESET;

COMMIT;
