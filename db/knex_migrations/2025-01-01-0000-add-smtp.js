exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("smtp_security").defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("smtp_security");
    });
};
