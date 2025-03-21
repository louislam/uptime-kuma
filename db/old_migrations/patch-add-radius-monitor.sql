-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD radius_username VARCHAR(255);

ALTER TABLE monitor
    ADD radius_password VARCHAR(255);

ALTER TABLE monitor
    ADD radius_calling_station_id VARCHAR(50);

ALTER TABLE monitor
    ADD radius_called_station_id VARCHAR(50);

ALTER TABLE monitor
    ADD radius_secret VARCHAR(255);

COMMIT;
