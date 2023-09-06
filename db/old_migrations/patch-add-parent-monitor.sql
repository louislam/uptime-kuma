-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD parent INTEGER REFERENCES [monitor] ([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
