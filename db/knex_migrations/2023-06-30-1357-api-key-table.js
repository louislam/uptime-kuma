/*
CREATE TABLE [api_key] (
    [id] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    [key] VARCHAR(255) NOT NULL,
    [name] VARCHAR(255) NOT NULL,
    [user_id] INTEGER NOT NULL,
    [created_date] DATETIME DEFAULT (DATETIME('now')) NOT NULL,
    [active] BOOLEAN DEFAULT 1 NOT NULL,
    [expires] DATETIME DEFAULT NULL,
    CONSTRAINT FK_user FOREIGN KEY ([user_id]) REFERENCES [user]([id]) ON DELETE CASCADE ON UPDATE CASCADE
);
 */
exports.up = function (knex) {
    return knex.schema.createTable("api_key", function (table) {
        table.increments("id").primary();
        table.string("key", 255).notNullable();
        table.string("name", 255).notNullable();
        table.integer("user_id").unsigned().notNullable()
            .references("id").inTable("user")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.dateTime("created_date").defaultTo(knex.fn.now()).notNullable();
        table.boolean("active").defaultTo(1).notNullable();
        table.dateTime("expires").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable("api_key");
};
