## Info

https://knexjs.org/guide/migrations.html#knexfile-in-other-languages


## Template

Filename: YYYYMMDDHHMMSS_name.js

```js
exports.up = function(knex) {

};

exports.down = function(knex) {

};

// exports.config = { transaction: false };
```

## Example

YYYY-MM-DD-HHMM-create-users-products.js

2023-06-30-1348-create-users-products.js

```js
exports.up = function(knex) {
  return knex.schema
    .createTable('users', function (table) {
        table.increments('id');
        table.string('first_name', 255).notNullable();
        table.string('last_name', 255).notNullable();
    })
    .createTable('products', function (table) {
        table.increments('id');
        table.decimal('price').notNullable();
        table.string('name', 1000).notNullable();
    });
};

exports.down = function(knex) {
  return knex.schema
      .dropTable("products")
      .dropTable("users");
};
```

https://knexjs.org/guide/migrations.html#transactions-in-migrations
