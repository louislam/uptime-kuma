import { betterAuth, Session } from "better-auth";
// @ts-ignore
import * as Database from "./database.js";
import { genSecret, log } from "../src/util";
import { R } from "redbean-node";
import { createPool } from "mysql2/promise";
import BetterSqlite3Database from "better-sqlite3";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { Socket } from "socket.io";
import { haveIBeenPwned } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { createAuthMiddleware, APIError } from "better-auth/api";
// @ts-ignore
import * as oldAuth from "./auth.js";
import { hasUser } from "./routers/better-auth-router";
import { symmetricEncrypt } from "better-auth/crypto";

export type BetterAuthUser = ReturnType<typeof createAuthInstance>["$Infer"]["Session"]["user"];

let authInstance: ReturnType<typeof createAuthInstance>;

/**
 * Get the singleton instance of better-auth
 * Mainly used for http and socket.io authentication
 * @returns The singleton instance of better-auth
 */
export function auth() {
    if (authInstance) {
        return authInstance;
    }
    authInstance = createAuthInstance();
    return authInstance;
}

/**
 * Do staff without any auth
 * For internal usage only, the api should be a superset of auth().api
 * @returns Internal adapter of better-auth
 */
export async function authInternal() {
    return (await auth().$context).internalAdapter;
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
    let database;
    if (Database.dbConfig.type.includes("mariadb")) {
        database = createPool({
            host: Database.dbConfig.host,
            port: Database.dbConfig.port,
            database: Database.dbConfig.database,
            user: Database.dbConfig.username,
            password: Database.dbConfig.password,
            timezone: "Z",
            ...(Database.dbConfig.socketPath ? { socketPath: Database.dbConfig.socketPath } : {}),
        });
    } else {
        database = new BetterSqlite3Database(Database.sqlitePath);
    }

    return betterAuth({
        database,

        // Just want to silent the warning message
        // As we don't use callback/redirect, it is not used
        baseURL: "http://localhost:3000",

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

            apiKey({
                schema: {
                    apikey: {
                        modelName: "better_auth_apikey",
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

        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                if (ctx.path.startsWith("/sign-in/")) {
                    const username = ctx.body?.username;
                    const password = ctx.body?.password;

                    // Migrate legacy user from old user table to better-auth
                    // Only do this when there is no user in better-auth
                    if (!(await hasUser())) {
                        await migrateUser(username, password);
                    }
                }
            }),
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
 * Encrypt a string using the BetterAuth encryption method
 * @param data The string to encrypt
 * @returns The encrypted string
 */
export async function betterAuthEncrypt(data: string): Promise<string> {
    const encrypted = await symmetricEncrypt({
        key: auth().options.secret,
        data,
    });

    return encrypted;
}

/**
 * Get session from cookie
 * @param cookie Cookie string
 * @returns Session Object
 */
export function getSession(cookie: string) {
    log.info("auth", "Logged in with httpOnly cookie session");
    const context = {
        headers: createHeaders(cookie),
    };
    return authInstance.api.getSession(context);
}

/**
 * Create Headers object with cookie for API calls
 * @param cookie Cookie string
 * @returns Headers object
 */
export function createHeaders(cookie: string) {
    const headers = new Headers();
    headers.set("cookie", cookie || "");
    return headers;
}

/**
 * Unfortunatety, there is no way to get a user object from better-auth api, so we have to craft a session object here.
 * @returns Crafted Session Object
 */
export async function getDisableAuthSession(): ReturnType<typeof getSession> {
    log.info("auth", "Logged in with Disable Auth");

    const obj = await R.getRow("SELECT * FROM better_auth_user LIMIT 1");

    if (!obj) {
        throw new Error("Unexpected Error: No user found in the database.");
    }

    const user = {
        id: obj.id as string,
        createdAt: obj.createdAt as Date,
        updatedAt: obj.updatedAt as Date,
        email: obj.email as string,
        emailVerified: obj.emailVerified === 1,
        name: obj.name as string,
        image: obj.image as string | null,
        username: obj.username as string | null,
        displayUsername: obj.displayUsername as string | null,
        banned: obj.banned === 1,
        role: obj.role as string | null,
        banReason: obj.banReason as string | null,
        banExpires: obj.banExpires as Date | null,
        twoFactorEnabled: obj.twoFactorEnabled === 1,
    };

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
 * For logged-in users, double-check the password
 * @param cookie Cookie string
 * @param currentPassword Password to verify
 * @throws Error if the password is incorrect or the user is not found
 */
export async function doubleCheckPassword(cookie: string, currentPassword: string): Promise<void> {
    const { status } = await authInstance.api.verifyPassword({
        body: {
            password: currentPassword,
        },
        headers: createHeaders(cookie),
    });

    if (!status) {
        throw new Error("Incorrect current password");
    }
}

/**
 * Migrate a legacy user from the old `user` table to better-auth tables.
 * @param username Legacy username
 * @param password Plain-text password from the login form
 */
export async function migrateUser(username: string, password: string) {
    const legacyUser = await oldAuth.login(username, password);
    if (legacyUser) {
        try {
            // Create BetterAuth user with the same username and password
            const newUser = await auth().api.createUser({
                body: {
                    name: username,
                    email: `${username}@noreply.uptime-kuma.internal`,
                    password,
                    role: "admin",
                    data: {
                        username,
                    },
                },
            });

            // Migrate 2FA settings if they exist
            if (legacyUser.twofa_status) {
                log.info("auth", `Migrating 2FA settings for user: ${username}`);

                const rowId = genSecret(32);
                const userId = newUser.user.id;

                const encryptedSecret = await betterAuthEncrypt(legacyUser.twofa_secret);
                const encryptedBackupCodes = await betterAuthEncrypt(JSON.stringify([])); // Empty backup codes for migration, as we don't have the original backup codes

                await R.knex("better_auth_twoFactor").insert({
                    id: rowId,
                    secret: encryptedSecret,
                    backupCodes: encryptedBackupCodes,
                    verified: true,
                    userId: userId,
                });

                await R.knex("better_auth_user").where({ id: userId }).update({
                    twoFactorEnabled: true,
                });
            }
            log.info("auth", `Migrated legacy user: ${username}`);
        } catch (e) {
            log.error("auth", `Failed to migrate legacy user ${username}:`, e);
        }
    } else {
        log.info("auth", `No legacy user found for username: ${username}, do not migrate.`);
    }
}

/**
 * Check username / password without creating a session, mainly for basic auth
 * @param username Legacy username
 * @param password Plain-text password from the login form
 */
export async function checkPassword(username: string, password: string): Promise<boolean> {
    const { adapter, password: passwordVerifier } = await auth().$context;
    const internalAdapter = await authInternal();

    const user = await adapter.findOne<Record<string, any>>({
        model: "user",
        where: [{ field: "username", value: username }],
    });

    if (!user) {
        return false;
    }

    const accounts = await internalAdapter.findAccounts(user.id);
    const credentialAccount = accounts.find((ac) => ac.providerId === "credential");

    if (!credentialAccount?.password) {
        return false;
    }

    return passwordVerifier.verify({
        hash: credentialAccount.password,
        password,
    });
}
