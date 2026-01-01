exports.up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.smallint("heartbeat_bar_days").notNullable().defaultTo(0).checkBetween([ 0, 365 ]);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("heartbeat_bar_days");
    });
};
