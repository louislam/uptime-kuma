exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("docker_service", 255);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("docker_service");
    });
};
