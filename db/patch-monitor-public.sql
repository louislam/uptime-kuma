BEGIN TRANSACTION;

alter table monitor
    add public BOOLEAN default 0 not null;

COMMIT;
