exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("elasticsearch_nodes").notNullable().defaultTo("[]");
        table.string("elasticsearch_status", 16).notNullable().defaultTo("yellow");
        table.integer("elasticsearch_minimum_nodes").notNullable().defaultTo(0);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("elasticsearch_nodes");
        table.dropColumn("elasticsearch_status");
        table.dropColumn("elasticsearch_minimum_nodes");
    });
};
