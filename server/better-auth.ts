import { betterAuth } from "better-auth";
import * as Database from "./database.js";
import { genSecret, log } from "../src/util";
import { R } from "redbean-node";
import { KyselyKnexDialect, MySQL2ColdDialect, SQLite3ColdDialect } from "kysely-knex";

// Check if Database.initDataDir() has been called before using this function
if (!Database.dataDir) {
    throw new Error(
        "Database data directory is not initialized. Please call Database.initDataDir() before using auth."
    );
}

const knex = R.knex;

const kyselySubDialect = Database.dbConfig.type.includes("mariadb")
    ? new MySQL2ColdDialect()
    : new SQLite3ColdDialect();

const database = new KyselyKnexDialect({
    kyselySubDialect,
    knex,
});

export const auth = betterAuth({
    database,
    secret: getAuthSecret(),
    trustedOrigins: ["*"],
    emailAndPassword: {
        enabled: true,
        // disableSignUp: true,
    },

    user: {
        modelName: "better_auth_user",
    },
    account: {
        modelName: "better_auth_account",
    },
    session: {
        modelName: "better_auth_session",
    },
    verification: {
        modelName: "better_auth_verification",
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
    await auth.api.signUpEmail({
        body: {
            email: "john@doe.com",
            password: "password",
            name: "John Doe",
        },
    });
}

createUser();

/**
 *
 */
export async function migrateUser() {}
