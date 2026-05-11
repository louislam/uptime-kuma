exports.up = function (knex) {
    return knex.schema.hasColumn("monitor", "network_profile_id").then((exists) => {
        if (exists) {
            return null;
        }
        return knex.schema.alterTable("monitor", function (table) {
            table.string("network_profile_id", 64).defaultTo(null);
        });
    });
};

exports.down = function (knex) {
    return knex.schema.hasColumn("monitor", "network_profile_id").then((exists) => {
        if (!exists) {
            return null;
        }
        return knex.schema.alterTable("monitor", function (table) {
            table.dropColumn("network_profile_id");
        });
    });
};
