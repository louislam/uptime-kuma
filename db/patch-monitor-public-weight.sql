BEGIN TRANSACTION;

alter table monitor
    add public_weight BOOLEAN default 1000 not null;

COMMIT;
