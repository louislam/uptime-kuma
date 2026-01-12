exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.boolean("save_response").notNullable().defaultTo(false);
        table.boolean("save_error_response").notNullable().defaultTo(false);
        table.integer("response_max_length").defaultTo(10240); // Default 10KB
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("save_response");
        table.dropColumn("save_error_response");
        table.dropColumn("response_max_length");
    });
};
