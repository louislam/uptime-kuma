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

type BetterAuthUser = ReturnType<typeof createAuthInstance>["$Infer"]["Session"]["user"];

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

            twoFactor({
                schema: {
                    twoFactor: {
                        modelName: "better_auth_twoFactor",
                    },
                },
            }),

            // It is not suitable for "Disable Auth", because it can not turn on/off after init.
            //anonymous(),
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
    log.info("auth", "Logged in with httpOnly cookie session");
    const context = {
        headers: new Headers(),
    };
    context.headers.set("cookie", cookie || "");
    return authInstance.api.getSession(context);
}

/**
 *
 */
export async function getDisableAuthSession(): ReturnType<typeof getSession> {
    log.info("auth", "Logged in with Disable Auth");

    const { users, total } = await authInstance.api.listUsers({
        query: {
            limit: 1,
        },
    });

    if (total == 0) {
        throw new Error("Unexpected error. No users found");
    }

    // Seems bugged, user from listUsers does not have all properties
    // Force parse the user object to BetterAuthUser.
    // https://github.com/better-auth/better-auth/issues/7452
    const user = users[0] as BetterAuthUser;

    return {
        user,
        session: {
            id: "disable-auth",
            userId: user.id,
            ipAddress: null,
            userAgent: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
            token: "disable-auth",
        },
    };
}

/**
 * Check Login (Better Auth New!)
 * @param socket Socket.IO Socket
 * @throws Error if not logged in
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
export async function migrateUser() {
    // TODO: User have to input pwd one time to migrate, or we can not get the original password hash to create a better-auth user
    // TODO: Disable Auth may need to directly create a user in the database
}
