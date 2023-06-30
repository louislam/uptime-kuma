/*
ALTER TABLE monitor
    ADD parent INTEGER REFERENCES [monitor] ([id]) ON DELETE SET NULL ON UPDATE CASCADE;
 */
exports.up = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.integer("parent").unsigned()
            .references("id").inTable("monitor")
            .onDelete("SET NULL")
            .onUpdate("CASCADE");
    });
};

exports.down = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.dropColumn("parent");
    });
};
