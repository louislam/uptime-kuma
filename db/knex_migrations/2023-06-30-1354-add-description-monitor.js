// ALTER TABLE monitor ADD description TEXT default null;
exports.up = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.text("description").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.dropColumn("description");
    });
};
