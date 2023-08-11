-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

DROP TABLE maintenance_timeslot;

-- 999 characters. https://stackoverflow.com/questions/46134830/maximum-length-for-cron-job
ALTER TABLE maintenance ADD cron TEXT;
ALTER TABLE maintenance ADD timezone VARCHAR(255);
ALTER TABLE maintenance ADD duration INTEGER;

COMMIT;
