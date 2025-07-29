-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

UPDATE monitor SET timeout = (interval * 0.8)
WHERE timeout IS NULL OR timeout <= 0;

COMMIT;
