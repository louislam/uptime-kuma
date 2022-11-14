-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD grpc_url VARCHAR(255) default null;

ALTER TABLE monitor
    ADD grpc_protobuf TEXT default null;

ALTER TABLE monitor
    ADD grpc_body TEXT default null;

ALTER TABLE monitor
    ADD grpc_metadata TEXT default null;

ALTER TABLE monitor
    ADD grpc_method VARCHAR(255) default null;

ALTER TABLE monitor
    ADD grpc_service_name VARCHAR(255) default null;

ALTER TABLE monitor
    ADD grpc_enable_tls BOOLEAN default 0 not null;

COMMIT;
