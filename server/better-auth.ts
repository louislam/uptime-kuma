import { betterAuth } from "better-auth";
import { DatabaseSync } from "node:sqlite";
import * as Database from "./database.js";
import { genSecret, log } from "../src/util";
import { createPool } from "mysql2/promise";

// Check if Database.initDataDir() has been called before using this function
if (!Database.dataDir) {
    throw new Error("Database data directory is not initialized. Please call Database.initDataDir() before using auth.");
}

let database: DatabaseSync;

// Better Auth is not supported with knex, so we need to create a separate connection here
if (Database.dbConfig.type == "sqlite") {
    log.debug("better-auth", "Initializing better-auth with SQLite database at", Database.sqlitePath);
    database = new DatabaseSync(Database.sqlitePath);

} else if (Database.dbConfig.type == "mariadb") {

    // TODO

} else if (Database.dbConfig.type == "embedded-mariadb") {
    log.debug("better-auth", "Initializing better-auth with MariaDB database");

    // TODO

}

export const auth = betterAuth({
    database,
    secret: getAuthSecret(),
    trustedOrigins: [ "*" ],
    emailAndPassword: {
        enabled: true,
    },
});

/**
 * Get the authentication secret for better-auth
 * @returns The authentication secret
 */
export function getAuthSecret() {
    const env = process.env.UPTIME_KUMA_AUTH_SECRET;
    if (env) {
        return env;
    }

    if (!Database.dbConfig.authSecret) {
        Database.dbConfig.authSecret = genSecret();
        Database.writeDBConfig(Database.dbConfig);
    }

    return Database.dbConfig.authSecret;
}

/**
 *
 */
export async function createUser() {

}
