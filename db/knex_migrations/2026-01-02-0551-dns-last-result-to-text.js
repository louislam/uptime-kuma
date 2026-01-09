// Change dns_last_result column from VARCHAR(255) to TEXT to handle longer DNS TXT records
exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("dns_last_result").alter();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("dns_last_result", 255).alter();
    });
};
