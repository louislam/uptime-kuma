-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE proxy (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    user_id INT NOT NULL,
    protocol VARCHAR(10) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port SMALLINT NOT NULL,
    auth BOOLEAN NOT NULL,
    username VARCHAR(255) NULL,
    password VARCHAR(255) NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    'default' BOOLEAN NOT NULL DEFAULT 0,
    created_date DATETIME DEFAULT (DATETIME('now')) NOT NULL
);

ALTER TABLE monitor ADD COLUMN proxy_id INTEGER REFERENCES proxy(id);

CREATE INDEX proxy_id ON monitor (proxy_id);
CREATE INDEX proxy_user_id ON proxy (user_id);

COMMIT;
