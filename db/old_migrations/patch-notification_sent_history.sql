-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

CREATE TABLE [notification_sent_history] (
    [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    [type] VARCHAR(50) NOT NULL,
    [monitor_id] INTEGER NOT NULL,
    [days] INTEGER NOT NULL,
    UNIQUE([type], [monitor_id], [days])
);

CREATE INDEX [good_index] ON [notification_sent_history] (
    [type],
    [monitor_id],
    [days]
);

COMMIT;
