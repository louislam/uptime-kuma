-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor 
    ADD COLUMN IF NOT EXISTS invert_keyword BOOLEAN DEFAULT 0 NOT NULL;

COMMIT;
