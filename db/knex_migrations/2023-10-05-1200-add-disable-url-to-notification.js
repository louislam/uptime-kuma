exports.up = function(knex) {
    return knex.schema.alterTable("notification", function(table) {
        table.boolean("disable_url").defaultTo(false).notNullable().comment("Disable URL in Discord notifications");
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable("notification", function(table) {
        table.dropColumn("disable_url");
    });
};
