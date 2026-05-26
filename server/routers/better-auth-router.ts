import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../better-auth";
import { R } from "redbean-node";

let processingSetup = false;
let hasUser = false;

/**
 * For testing: http://localhost:3001/api/auth/ok
 * @returns Router
 */
export async function createBetterAuthRouter() {
    const betterAuthRouter = express.Router();
    betterAuthRouter.all("/api/auth/*", toNodeHandler(auth()));

    // First Setup
    betterAuthRouter.post("/api/auth/setup", async (req, res) => {
        try {
            if (processingSetup) {
                throw new Error("Setup is already in progress. Please wait.");
            }

            try {
                processingSetup = true;
                if (!(await needSetup())) {
                    throw new Error(
                        "Uptime Kuma has been initialized. If you want to run setup again, please delete the database."
                    );
                }
            } finally {
                processingSetup = false;
            }
        } catch (e) {
            res.status(400).json({
                error: e instanceof Error ? e.message : "Unknown error",
            });
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
