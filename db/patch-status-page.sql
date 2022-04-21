-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE [status_page](
    [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    [slug] VARCHAR(255) NOT NULL UNIQUE,
    [title] VARCHAR(255) NOT NULL,
    [description] TEXT,
    [icon] VARCHAR(255) NOT NULL,
    [theme] VARCHAR(30) NOT NULL,
    [published] BOOLEAN NOT NULL DEFAULT 1,
    [search_engine_index] BOOLEAN NOT NULL DEFAULT 1,
    [show_tags] BOOLEAN NOT NULL DEFAULT 0,
    [password] VARCHAR,
    [created_date] DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [modified_date] DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX [slug] ON [status_page]([slug]);


CREATE TABLE [status_page_cname](
    [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    [status_page_id] INTEGER NOT NULL REFERENCES [status_page]([id]) ON DELETE CASCADE ON UPDATE CASCADE,
    [domain] VARCHAR NOT NULL UNIQUE
);

ALTER TABLE incident ADD status_page_id INTEGER;
ALTER TABLE [group] ADD status_page_id INTEGER;

COMMIT;
