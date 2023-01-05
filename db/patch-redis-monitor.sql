BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD redis_connection_string VARCHAR(255);

COMMIT
