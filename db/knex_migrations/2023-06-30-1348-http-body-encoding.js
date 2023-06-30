// ALTER TABLE monitor ADD http_body_encoding VARCHAR(25);
// UPDATE monitor SET http_body_encoding = 'json' WHERE (type = 'http' or type = 'keyword') AND http_body_encoding IS NULL;
exports.up = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.string("http_body_encoding", 25);
    }).then(function () {
        knex("monitor")
            .where(function () {
                this.where("type", "http").orWhere("type", "keyword");
            })
            .whereNull("http_body_encoding")
            .update({
                http_body_encoding: "json",
            });
    });
};

exports.down = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.dropColumn("http_body_encoding");
    });
};
