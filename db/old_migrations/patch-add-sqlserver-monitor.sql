BEGIN TRANSACTION;

 ALTER TABLE monitor
     ADD database_connection_string VARCHAR(2000);

 ALTER TABLE monitor
     ADD database_query TEXT;


 COMMIT
