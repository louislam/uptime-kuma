-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    RENAME COLUMN kafka_producer_ssl TO kafka_producer_ssl_old;

ALTER TABLE monitor
    RENAME COLUMN kafka_producer_allow_auto_topic_creation TO kafka_producer_allow_auto_topic_creation_old;

ALTER TABLE monitor
    ADD COLUMN kafka_producer_ssl BOOLEAN default 0 NOT NULL;

ALTER TABLE monitor
    ADD COLUMN kafka_producer_allow_auto_topic_creation BOOLEAN default 0 NOT NULL;

UPDATE monitor set kafka_producer_allow_auto_topic_creation = monitor.kafka_producer_allow_auto_topic_creation_old;
UPDATE monitor set kafka_producer_ssl = monitor.kafka_producer_ssl_old;

COMMIT;
