exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("rabbitmq_nodes");
        table.string("rabbitmq_username");
        table.string("rabbitmq_password");
    });

};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("rabbitmq_nodes");
        table.dropColumn("rabbitmq_username");
        table.dropColumn("rabbitmq_password");
    });

};
