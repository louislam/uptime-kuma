exports.up = function (knex) {
    return knex.schema.alterTable("stat_daily", function (table) {
        table.integer("up").unsigned().notNullable().alter();
        table.integer("down").unsigned().notNullable().alter();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("stat_daily", function (table) {
        table.smallint("up").notNullable().alter();
        table.smallint("down").notNullable().alter();
    });
};
