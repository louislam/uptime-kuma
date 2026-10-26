import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../better-auth";
import { R } from "redbean-node";
import { log } from "../../src/util";

// @ts-ignore
import { allowDevOrigin } from "../util-server.js";
import { generalErrorResponse } from "../util2";

let processingSetup = false;
let _hasUser = false;
let expired = false;
let setupTimeout: NodeJS.Timeout | null = null;

const expiredMsg = "Setup has expired. Please restart the server to try again.";

/**
 * For testing: http://localhost:3001/api/auth/ok
 * @returns Express Router with better-auth routes and setup route.
 */
export async function createBetterAuthRouter() {
    const betterAuthRouter = express.Router();
    betterAuthRouter.all("/api/auth/*", async (req, res) => {
        allowDevOrigin(req, res);
        return toNodeHandler(auth())(req, res);
    });

    // First Setup
    betterAuthRouter.post("/api/setup", async (req, res) => {
        allowDevOrigin(req, res);

        try {
            if (expired) {
                log.error("auth", expiredMsg);
                throw new Error(expiredMsg);
            }

            if (processingSetup) {
                throw new Error("Setup is already in progress. Please wait.");
            }

            processingSetup = true;

            try {
                if (!(await needSetup())) {
                    throw new Error(
                        "Uptime Kuma has been initialized. If you want to run setup again, please delete the database."
                    );
                }

                const username = req.body.username;
                const password = req.body.password;

                const user = await createFirstAdmin(username, password);
                log.debug("auth", "First user created:", user);

                res.json({ ok: true });
            } finally {
                processingSetup = false;
            }
        } catch (e) {
            log.error("auth", "Setup error:", e instanceof Error ? e.message : e);
            generalErrorResponse(res, e);
        }
    });

    return betterAuthRouter;
}

/**
 * Whether Better Auth has a user.
 * @param {boolean} checkLegacyUser Also check the old `user` table
 * @returns {Promise<boolean>} Whether a user exists
 */
export async function hasUser(checkLegacyUser = false) {
    if (_hasUser) {
        return true;
    }

    const { count } = await R.knex("better_auth_user").count("id as count").first();
    if (Number(count) !== 0) {
        return true;
    }

    if (!checkLegacyUser) {
        return false;
    }

    // The user may be in the old user table, check that as well
    const oldUserCountRow = await R.knex("user").count("id as count").first();
    return Number(oldUserCountRow.count) !== 0;
}

/**
 * Create the first admin user.
 * @param {string} username Admin username
 * @param {string} password Admin password
 * @returns {Promise<object>} The created user
 * @throws {Error} If Uptime Kuma already has a user, or Better Auth rejects the user
 */
export async function createFirstAdmin(username: string, password: string) {
    if (await hasUser(true)) {
        throw new Error(
            "Uptime Kuma has been initialized. If you want to run setup again, please delete the database."
        );
    }

    let user;
    try {
        user = await auth().api.createUser({
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
    } catch (createError) {
        // HIBP rejected after admin user creation, we need to clean up the partially created user
        // very stupid.... https://github.com/better-auth/better-auth/issues/11706
        try {
            if (username) {
                await R.knex("better_auth_user").where({ username }).del();
            }
        } catch (cleanupError) {}
        throw createError;
    }

    _hasUser = true;
    return user;
}

/**
 * @returns Whether setup is needed.
 */
export async function needSetup() {
    if (!setupTimeout) {
        setupTimeout = setTimeout(
            () => {
                expired = true;
                log.error("auth", expiredMsg);
            },
            1000 * 60 * 10
        );
    }

    if (expired) {
        return false;
    }

    return !(await hasUser(true));
}
