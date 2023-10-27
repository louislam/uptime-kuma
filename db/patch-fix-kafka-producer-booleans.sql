-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    MODIFY COLUMN kafka_producer_ssl BOOLEAN default 0 NOT NULL;

ALTER TABLE monitor
    MODIFY COLUMN kafka_producer_allow_auto_topic_creation BOOLEAN default 0 NOT NULL;

COMMIT;
