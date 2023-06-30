/*
-- 999 characters. https://stackoverflow.com/questions/46134830/maximum-length-for-cron-job
DROP TABLE maintenance_timeslot;
ALTER TABLE maintenance ADD cron TEXT;
ALTER TABLE maintenance ADD timezone VARCHAR(255);
ALTER TABLE maintenance ADD duration INTEGER;
 */
exports.up = function (knex) {
    return knex.schema
        .dropTableIfExists("maintenance_timeslot")
        .table("maintenance", function (table) {
            table.text("cron");
            table.string("timezone", 255);
            table.integer("duration");
        });
};

exports.down = function (knex) {
    return knex.schema
        .table("maintenance", function (table) {
            table.dropColumn("cron");
            table.dropColumn("timezone");
            table.dropColumn("duration");
        });
};
