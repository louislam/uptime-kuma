-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD slow_response_notification BOOLEAN default 0;

ALTER TABLE monitor
    ADD slow_response_notification_threshold INTEGER default 0;

ALTER TABLE monitor
    ADD slow_response_notification_range INTEGER default 0;

ALTER TABLE monitor
    ADD slow_response_notification_method VARCHAR(255);

COMMIT;
