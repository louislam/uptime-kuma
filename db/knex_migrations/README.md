# Info

https://knexjs.org/guide/migrations.html#knexfile-in-other-languages

## Basic rules

- All tables must have a primary key named `id`
- Filename format: `YYYY-MM-DD-HHMM-patch-name.js`
- Avoid native SQL syntax, use knex methods, because Uptime Kuma supports SQLite and MariaDB.

## Template

```js
exports.up = function(knex) {

};

exports.down = function(knex) {

};

// exports.config = { transaction: false };
```

## Example

Filename: 2023-06-30-1348-create-user-and-product.js

```js
exports.up = function(knex) {
  return knex.schema
    .createTable('user', function (table) {
        table.increments('id');
        table.string('first_name', 255).notNullable();
        table.string('last_name', 255).notNullable();
    })
    .createTable('product', function (table) {
        table.increments('id');
        table.decimal('price').notNullable();
        table.string('name', 1000).notNullable();
    }).then(() => {
        knex("products").insert([
            { price: 10, name: "Apple" },
            { price: 20, name: "Orange" },
        ]);
    });
};

exports.down = function(knex) {
  return knex.schema
      .dropTable("product")
      .dropTable("user");
};
```

https://knexjs.org/guide/migrations.html#transactions-in-migrations
