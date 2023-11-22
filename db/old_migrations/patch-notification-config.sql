-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

-- SQLite: Change the data type of the column "config" from VARCHAR to TEXT
ALTER TABLE notification RENAME COLUMN config TO config_old;
ALTER TABLE notification ADD COLUMN config TEXT;
UPDATE notification SET config = config_old;
ALTER TABLE notification DROP COLUMN config_old;

COMMIT;
