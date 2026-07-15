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

            try {
                if (!(await needSetup())) {
                    throw new Error(
                        "Uptime Kuma has been initialized. If you want to run setup again, please delete the database."
                    );
                }
                processingSetup = true;

                const username = req.body.username;
                const password = req.body.password;
                const user = await auth().api.createUser({
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

                log.debug("auth", "First user created:", user);

                _hasUser = true;
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
 *
 */
export async function hasUser() {
    if (_hasUser) {
        return true;
    }
    return (await R.knex("better_auth_user").count("id as count").first()).count !== 0;
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
    if (processingSetup) {
        return false;
    }

    if (await hasUser()) {
        return false;
    }

    // The user may be in the old user table, check that as well
    const hasOldUser = (await R.knex("user").count("id as count").first()).count !== 0;

    return !hasOldUser;
}
