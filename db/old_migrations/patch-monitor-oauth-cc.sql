-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE monitor
    ADD oauth_client_id TEXT default null;

ALTER TABLE monitor
    ADD oauth_client_secret TEXT default null;

ALTER TABLE monitor
    ADD oauth_token_url TEXT default null;

ALTER TABLE monitor
    ADD oauth_scopes TEXT default null;

ALTER TABLE monitor
    ADD oauth_auth_method TEXT default null;

COMMIT;
