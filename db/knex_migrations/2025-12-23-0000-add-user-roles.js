exports.up = async function (knex) {
    // Add role column to user table
    // Default role is 'user', admin role for elevated privileges
    await knex.schema.alterTable("user", function (table) {
        table.string("role", 50).notNullable().defaultTo("user");
    });

    // Set the first user (the setup user) as admin
    // This ensures backward compatibility for existing installations
    const userCount = await knex("user").count("id as count").first();
    if (userCount && userCount.count > 0) {
        // Get the first user by ID and set them as admin
        const firstUser = await knex("user").orderBy("id", "asc").first();
        if (firstUser) {
            await knex("user").where("id", firstUser.id).update({ role: "admin" });
        }
    }
};

exports.down = async function (knex) {
    // Remove role column from user table
    await knex.schema.alterTable("user", function (table) {
        table.dropColumn("role");
    });
};
