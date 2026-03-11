/* SQL:
ALTER TABLE monitor ADD ping_threshold INTEGER null;
ALTER TABLE monitor ADD ping_threshold_action VARCHAR(20) default 'down' not null;
ALTER TABLE monitor ADD ping_threshold_last_notified_state BOOLEAN default null;
*/
exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.integer("ping_threshold").nullable();
        table.string("ping_threshold_action", 20).notNullable().defaultTo("down");
        table.boolean("ping_threshold_last_notified_state").nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ping_threshold_last_notified_state");
        table.dropColumn("ping_threshold");
        table.dropColumn("ping_threshold_action");
    });
};
