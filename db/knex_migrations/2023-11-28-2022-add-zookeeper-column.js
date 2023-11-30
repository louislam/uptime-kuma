exports.up = function (knex) {
    // update monitor.push_token to 32 length
    return knex.schema.alterTable("monitor", function (table) {
        table.string("zookeeper_host", 255);
        table
            .integer("zookeeper_timeout")
            .unsigned()
            .notNullable()
            .defaultTo(5000);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("zookeeper_host");
        table.dropColumn("zookeeper_timeout");
    });
};
