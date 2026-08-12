exports.up = function (knex) {
    return knex.schema.alterTable("maintenance", (table) => {
        // Per-maintenance opt-in for the "maintenance scheduled" subscriber
        // email (see notifyMaintenanceScheduled). Off by default - minor
        // maintenances shouldn't spam group subscribers; the admin turns
        // this on for maintenances that actually warrant an email. The
        // maintenance is always recorded in the Maintenance and Incident
        // Log regardless of this flag.
        table.boolean("notify_subscribers").notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("maintenance", (table) => {
        table.dropColumn("notify_subscribers");
    });
};
