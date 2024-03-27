exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", (table) => {
            table.string("json_path_operator");
        })
        .then(() =>
            knex("monitor")
                .whereNotNull("expected_value")
                .update({
                    "json_path_operator": "=="
                })
        );
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", (table) => {
            table.dropColumn("json_path_operator");
        });
};
