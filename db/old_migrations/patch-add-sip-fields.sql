BEGIN TRANSACTION;



ALTER TABLE monitor

    ADD sip_auth_method VARCHAR(10) default null;  

COMMIT;





BEGIN TRANSACTION;



ALTER TABLE monitor

    ADD sip_protocol VARCHAR(10);  

COMMIT;



BEGIN TRANSACTION;



ALTER TABLE monitor

    ADD sip_port INT;  



ALTER TABLE monitor

    ADD sip_url VARCHAR(255);  



COMMIT;

BEGIN TRANSACTION;



ALTER TABLE monitor

    ADD sip_maintainence BOOLEAN;



COMMIT;

BEGIN TRANSACTION;



ALTER TABLE monitor

  ADD COLUMN sip_method VARCHAR(250) NULL;

  

COMMIT;