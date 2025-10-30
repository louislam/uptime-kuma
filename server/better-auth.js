const { betterAuth } = require("better-auth");
const { Kysely, SqliteDialect } = require("kysely");
const { R } = require("redbean-node");
const Database = require("./database");

let auth = undefined;

/**
 *
 */
async function getAuth() {
    if (!auth) {
        auth = betterAuth({
            database: await getDatabase(),
            secret: "TODO-testing-secret-change-me",
            trustedOrigins: [ "*" ],
            emailAndPassword: {
                enabled: true,
            },
        });
    }
    return auth;
}

/**
 * Creates a Kysely dialect for SQLite.
 * @param {sqlite3.Database} database The SQLite database instance.
 * @returns {SqliteDialect} The Kysely SQLite dialect.
 */
function createSQLiteKyselyDialect(database) {
    return new SqliteDialect({
        database,
    });
}

/**
 *
 */
async function getDatabase() {
    const rawConn = await R.knex.client.acquireConnection();

    console.log(rawConn.run);

    if (Database.dbConfig.type === "sqlite") {
        console.log("Creating Kysely SQLite dialect");
        return new Kysely({
            dialect: createSQLiteKyselyDialect(rawConn),
        });
    } else {
        return rawConn;
    }
}

module.exports = {
    getAuth,
};
