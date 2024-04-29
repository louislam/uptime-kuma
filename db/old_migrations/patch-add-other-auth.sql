BEGIN TRANSACTION;

  ALTER TABLE monitor
      ADD auth_method VARCHAR(250);

  ALTER TABLE monitor
      ADD auth_domain TEXT;
  ALTER TABLE monitor

      ADD auth_workstation TEXT;

COMMIT;

BEGIN TRANSACTION;
  UPDATE monitor
        SET auth_method = 'basic'
        WHERE basic_auth_user is not null;
COMMIT;
