import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../better-auth";
import { R } from "redbean-node";
import { log } from "../../src/util";

// @ts-ignore
import { allowDevOrigin } from "../util-server.js";
import { generalErrorResponse } from "../util2";

let processingSetup = false;
let hasUser = false;

/**
 * For testing: http://localhost:3001/api/auth/ok
 * @returns Express Router with better-auth routes and setup route.
 */
export async function createBetterAuthRouter() {
    const betterAuthRouter = express.Router();
    const callback = toNodeHandler(auth());
    betterAuthRouter.all("/api/auth/*", async (req, res) => {
        allowDevOrigin(req, res);
        return callback(req, res);
    });

    // First Setup
    betterAuthRouter.post("/api/setup", async (req, res) => {
        allowDevOrigin(req, res);

        try {
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

                hasUser = true;
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
 * @returns Whether setup is needed.
 */
export async function needSetup() {
    if (processingSetup) {
        return false;
    }
    if (hasUser) {
        return false;
    }
    hasUser = (await R.knex("better_auth_user").count("id as count").first()).count !== 0;
    return !hasUser;
}
