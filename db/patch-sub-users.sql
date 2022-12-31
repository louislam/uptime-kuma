-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE [sub_users](
    [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    [username] VARCHAR(150) NOT NULL,
    [password] VARCHAR(150) NOT NULL
);

COMMIT;
