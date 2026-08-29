/*
 * The api key schema from: https://www.better-auth.com/docs/plugins/api-key/reference#schema
 * Plugin: @better-auth/api-key (modelName: better_auth_apikey)
 */
exports.up = function (knex) {
    return knex.schema.createTable("better_auth_apikey", (t) => {
        t.string("id").primary();
        t.string("configId").notNullable().defaultTo("default").index();
        t.string("name");
        t.string("start");
        t.string("prefix");
        t.string("key").notNullable().index();
        t.string("referenceId")
            .notNullable()
            .index()
            .references("id")
            .inTable("better_auth_user")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        t.integer("refillInterval");
        t.integer("refillAmount");
        t.timestamp("lastRefillAt");
        t.boolean("enabled").defaultTo(true);
        t.boolean("rateLimitEnabled").defaultTo(true);
        t.bigInteger("rateLimitTimeWindow");
        t.integer("rateLimitMax");
        t.integer("requestCount").defaultTo(0);
        t.integer("remaining");
        t.timestamp("lastRequest");
        t.timestamp("expiresAt");
        t.timestamp("createdAt").notNullable();
        t.timestamp("updatedAt").notNullable();
        t.text("permissions");
        t.text("metadata");
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("better_auth_apikey");
};
