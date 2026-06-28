import { betterAuth, Session } from "better-auth";
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
import { createAuthMiddleware, APIError } from "better-auth/api";

export type BetterAuthUser = ReturnType<typeof createAuthInstance>["$Infer"]["Session"]["user"];

let authInstance: ReturnType<typeof createAuthInstance>;
let godKumaHeaders: Headers;
let godKumaInitSecret: string = "";

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
            sendResetPassword: async ({ user, url, token }, request) => {
                // TODO
            },
            onPasswordReset: async ({ user }, request) => {
                // TODO
            },
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

        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                // God Kuma is not allowed to login from the outside, only for internal usage
                if (ctx.path.startsWith("/sign-in/")) {
                    const username = ctx.body?.username;
                    const email = ctx.body?.email;
                    if (username?.startsWith("god_kuma_") || email?.endsWith("@god.uptime-kuma.internal")) {
                        if (!godKumaInitSecret || ctx.headers?.get("god-kuma-init-secret") != godKumaInitSecret) {
                            throw new APIError("BAD_REQUEST", {
                                message: "God Kuma is not allowed to login from the outside.",
                            });
                        }
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
 * TODO
 */
export async function migrateUser() {
    // TODO: User have to input pwd one time to migrate, or we can not get the original password hash to create a better-auth user
    // TODO: Disable Auth may need to directly create a user in the database
}

/**
 * Because there is no way to do admin operations without admin session
 * We have to create a god admin user to do operations
 * @param removeExistingGodKuma For server restart, remove previous god kuma user. But for short time scripts like reset password, you probably don't want to remove.
 * @returns Headers for the temp admin user
 */
export async function getGodKumaHeaders(removeExistingGodKuma = true): Promise<Headers> {
    if (!godKumaHeaders) {
        const username = "god_kuma_" + genSecret(16);
        const password = genSecret();
        const email = `${username}@god.uptime-kuma.internal`;

        await auth().api.createUser({
            body: {
                name: "God Kuma (Temp)",
                email: email,
                password,
                role: "admin",
                data: {
                    username,
                },
            },
        });

        godKumaInitSecret = genSecret();

        // Sign in
        const response = await auth().api.signInEmail({
            body: {
                email,
                password,
            },
            headers: {
                "god-kuma-init-secret": godKumaInitSecret,
            },
            asResponse: true,
        });

        const header = new Headers();
        header.set("cookie", response.headers.get("set-cookie") || "");
        header.set("god-kuma-email", email);

        godKumaHeaders = header;

        if (removeExistingGodKuma) {
            await removeOtherGodKumaUsers();
        }
    }

    return godKumaHeaders;
}

/**
 * Remove other god kuma users
 */
export async function removeOtherGodKumaUsers() {
    let searchValue = "@god.uptime-kuma.internal";
    let email = godKumaHeaders.get("god-kuma-email");

    if (!email) {
        throw new Error("Unexpected error: God Kuma email not found in headers.");
    }

    const result = await auth().api.listUsers({
        query: {
            searchField: "email",
            searchValue,
            searchOperator: "ends_with",
        },
        headers: godKumaHeaders,
    });

    for (const user of result.users) {
        if (user.email === email) {
            continue;
        }

        log.debug("auth", "Removing existing god kuma user:", user.email);
        // Delete the user
        await auth().api.removeUser({
            body: {
                userId: user.id,
            },
            headers: godKumaHeaders,
        });
    }
}
