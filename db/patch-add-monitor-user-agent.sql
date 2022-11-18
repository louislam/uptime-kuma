BEGIN TRANSACTION;

alter table monitor
    add user_agent varchar(50);

COMMIT;
