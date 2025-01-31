-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;
ALTER TABLE monitor ADD ping_count INTEGER default 1 not null;
ALTER TABLE monitor ADD ping_numeric BOOLEAN default true not null;
ALTER TABLE monitor ADD ping_deadline INTEGER default 10 not null;
ALTER TABLE monitor ADD ping_timeout INTEGER default 2 not null;
COMMIT;
