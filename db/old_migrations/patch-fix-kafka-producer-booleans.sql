-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

-- Rename COLUMNs to another one (suffixed by `_old`)
ALTER TABLE monitor
    RENAME COLUMN kafka_producer_ssl TO kafka_producer_ssl_old;

ALTER TABLE monitor
    RENAME COLUMN kafka_producer_allow_auto_topic_creation TO kafka_producer_allow_auto_topic_creation_old;

-- Add correct COLUMNs
ALTER TABLE monitor
    ADD COLUMN kafka_producer_ssl BOOLEAN default 0 NOT NULL;

ALTER TABLE monitor
    ADD COLUMN kafka_producer_allow_auto_topic_creation BOOLEAN default 0 NOT NULL;

-- These SQL is still not fully safe. See https://github.com/louislam/uptime-kuma/issues/4039.

-- Set bring old values from `_old` COLUMNs to correct ones
-- UPDATE monitor SET kafka_producer_allow_auto_topic_creation = monitor.kafka_producer_allow_auto_topic_creation_old
-- WHERE monitor.kafka_producer_allow_auto_topic_creation_old IS NOT NULL;

-- UPDATE monitor SET kafka_producer_ssl = monitor.kafka_producer_ssl_old
-- WHERE monitor.kafka_producer_ssl_old IS NOT NULL;

-- Remove old COLUMNs
ALTER TABLE monitor
    DROP COLUMN kafka_producer_allow_auto_topic_creation_old;

ALTER TABLE monitor
    DROP COLUMN kafka_producer_ssl_old;

COMMIT;
