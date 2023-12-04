-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE [api_key] (
    [id] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    [key] VARCHAR(255) NOT NULL,
    [name] VARCHAR(255) NOT NULL,
    [user_id] INTEGER NOT NULL,
    [created_date] DATETIME DEFAULT (DATETIME('now')) NOT NULL,
    [active] BOOLEAN DEFAULT 1 NOT NULL,
    [expires] DATETIME DEFAULT NULL,
    CONSTRAINT FK_user FOREIGN KEY ([user_id]) REFERENCES [user]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);

COMMIT;
