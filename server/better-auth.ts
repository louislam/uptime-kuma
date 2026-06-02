import { betterAuth } from "better-auth";
// @ts-ignore
import * as Database from "./database.js";
import { genSecret, log } from "../src/util";
import { R } from "redbean-node";
import { KyselyKnexDialect, MySQL2ColdDialect, SQLite3ColdDialect } from "kysely-knex";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { Socket } from "socket.io";
import { haveIBeenPwned } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { anonymous } from "better-auth/plugins";

let authInstance: ReturnType<typeof createAuthInstance>;

/**
 *
 */
export function auth() {
    if (authInstance) {
        return authInstance;
    }
    authInstance = createAuthInstance();
    return authInstance;
}

/**
 *
 */
function createAuthInstance() {
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

    return betterAuth({
        database,
        secret: getAuthSecret(),
        // Should be handled in Express.js, check better-auth-router.ts
        trustedOrigins: ["*"],
        emailAndPassword: {
            revokeSessionsOnPasswordReset: true,
            enabled: true,
            disableSignUp: false,
        },
        rateLimit: {
            // Seconds
            window: 60,

            // Requests per window
            max: 10,
        },
        plugins: [
            // Enable login by username
            username(),

            // Enable user management API (used for creating the first admin user)
            admin(),

            // Check if the password has been pwned in data breaches
            haveIBeenPwned(),

            twoFactor(),

            // Potentially for "Disable Auth"
            anonymous(),
        ],
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
}

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
 * Get session from cookie
 * @param cookie Cookie string
 * @returns Session Object
 */
export function getSession(cookie: string) {
    const context = {
        headers: new Headers(),
    };
    context.headers.set("cookie", cookie || "");
    return authInstance.api.getSession(context);
}

/**
 * @param socket
 */
export function checkLogin(socket: Socket) {
    // @ts-ignore
    if (!socket.session) {
        throw new Error("You are not logged in.");
    }
}

/**
 * TODO
 */
export async function migrateUser() {}
