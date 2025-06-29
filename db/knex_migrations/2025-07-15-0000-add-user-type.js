exports.up = async function (knex) {
    await knex.schema.alterTable('user', function (table) {
        table.string('user_type').notNullable().defaultTo('admin');
    });

    // If you want to set a default user type for existing users, you can do it here.
    // For example, set all existing users to 'admin'
    // await knex('user').update({ user_type: 'admin' });
};

exports.down = async function (knex) {
    await knex.schema.alterTable('user', function (table) {
        table.dropColumn('user_type');
    });
};
