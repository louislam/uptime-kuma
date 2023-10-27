exports.up = function (knex) {
    return knex.schema.table("monitor", function (table) {
        // Modify the kafka_producer_ssl column to boolean
        table
            .boolean("kafka_producer_ssl")
            .defaultTo(false)
            .notNullable()
            .alter();

        // Modify the kafka_producer_allow_auto_topic_creation column to boolean
        table
            .boolean("kafka_producer_allow_auto_topic_creation")
            .defaultTo(false)
            .notNullable()
            .alter();
    });
};

exports.down = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.integer("kafka_producer_ssl").alter();
        table.string("kafka_producer_allow_auto_topic_creation", 255).alter();
    });
};
