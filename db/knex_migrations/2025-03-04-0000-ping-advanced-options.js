/* SQL:
ALTER TABLE monitor ADD ping_count INTEGER default 1 not null;
ALTER TABLE monitor ADD ping_numeric BOOLEAN default true not null;
ALTER TABLE monitor ADD ping_deadline INTEGER default 10 not null;
ALTER TABLE monitor ADD ping_timeout INTEGER default 2 not null;
*/
exports.up = function (knex) {
    // Add new columns to table monitor
    return knex.schema
        .alterTable("monitor", function (table) {
            table.integer("ping_count").defaultTo(1).notNullable();
            table.boolean("ping_numeric").defaultTo(true).notNullable();
            table.integer("ping_deadline").defaultTo(10).notNullable();
            table.integer("ping_timeout").defaultTo(2).notNullable();
        });

};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("ping_count");
            table.dropColumn("ping_numeric");
            table.dropColumn("ping_deadline");
            table.dropColumn("ping_timeout");
        });
};
