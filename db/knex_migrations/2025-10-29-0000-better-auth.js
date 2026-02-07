/*
 * The schema from: https://www.better-auth.com/docs/concepts/database#core-schema
 */
exports.up = function (knex) {
    return knex.schema
        .createTable("better_auth_user", (t) => {
            t.string("id").primary();
            t.string("name").notNullable();
            t.string("email").notNullable();
            t.boolean("emailVerified").notNullable();
            t.string("image");
            t.timestamp("createdAt").notNullable();
            t.timestamp("updatedAt").notNullable();
        })
        .createTable("better_auth_session", (t) => {
            t.string("id").primary();
            t.string("userId").notNullable().references("id").inTable("better_auth_user");
            t.string("token").notNullable();
            t.timestamp("expiresAt").notNullable();
            t.string("ipAddress");
            t.string("userAgent");
            t.timestamp("createdAt").notNullable();
            t.timestamp("updatedAt").notNullable();
        })
        .createTable("better_auth_account", (t) => {
            t.string("id").primary();
            t.string("userId").notNullable().references("id").inTable("better_auth_user");
            t.string("accountId").notNullable();
            t.string("providerId").notNullable();
            t.string("accessToken");
            t.string("refreshToken");
            t.timestamp("accessTokenExpiresAt");
            t.timestamp("refreshTokenExpiresAt");
            t.string("scope");
            t.string("idToken");
            t.string("password");
            t.timestamp("createdAt").notNullable();
            t.timestamp("updatedAt").notNullable();
        })
        .createTable("better_auth_verification", (t) => {
            t.string("id").primary();
            t.string("identifier").notNullable();
            t.string("value").notNullable();
            t.timestamp("expiresAt").notNullable();
            t.timestamp("createdAt").notNullable();
            t.timestamp("updatedAt").notNullable();
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists("better_auth_verification")
        .dropTableIfExists("better_auth_account")
        .dropTableIfExists("better_auth_session")
        .dropTableIfExists("better_auth_user");
};
