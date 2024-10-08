-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
	ADD kafka_producer_topic VARCHAR(255);

ALTER TABLE monitor
	ADD kafka_producer_brokers TEXT;

ALTER TABLE monitor
	ADD kafka_producer_ssl INTEGER;

ALTER TABLE monitor
	ADD kafka_producer_allow_auto_topic_creation VARCHAR(255);

ALTER TABLE monitor
	ADD kafka_producer_sasl_options TEXT;

ALTER TABLE monitor
	ADD kafka_producer_message TEXT;

COMMIT;
