CREATE TABLE [temp_user](
  [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  [username] VARCHAR(255) NOT NULL UNIQUE COLLATE NOCASE,
  [password] VARCHAR(255),
  [active] BOOLEAN NOT NULL DEFAULT 1,
  [timezone] VARCHAR(150),
  twofa_secret VARCHAR(64),
  twofa_status BOOLEAN default 0 NOT NULL,
  twofa_last_token VARCHAR(6)
);

INSERT INTO [temp_user] SELECT
[id],
[username],
[password],
[active],
[timezone],
twofa_secret,
twofa_status,
twofa_last_token
 FROM user;

DROP TABLE user;

CREATE TABLE [user](
  [id] INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  [username] VARCHAR(255) NOT NULL UNIQUE COLLATE NOCASE,
  [password] VARCHAR(255),
  [active] BOOLEAN NOT NULL DEFAULT 1,
  [timezone] VARCHAR(150),
  twofa_secret VARCHAR(64),
  twofa_status BOOLEAN default 0 NOT NULL,
  twofa_last_token VARCHAR(6)
);

INSERT INTO [user] SELECT
[id],
[username],
[password],
[active],
[timezone],
twofa_secret,
twofa_status,
twofa_last_token
 FROM [temp_user];

DROP TABLE [temp_user];
