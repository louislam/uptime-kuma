console.log("== Uptime Kuma Remove 2FA Tool ==");

import { loadEnvFile } from "node:process";
import { R } from "redbean-node";

// @ts-ignore
import Database from "../server/database.js";

// @ts-ignore No type package is available
import parseArgs from "args-parser";

/**
 * Remove 2FA from every user, for when the authenticator app is lost
 * @returns {Promise<void>}
 */
async function main() {
    const args = parseArgs(process.argv);
    try {
        loadEnvFile();
    } catch {}

    Database.initDataDir(args);
    await Database.connect();

    const names: string[] = [];

    if (await R.knex.schema.hasTable("better_auth_twofactor")) {
        const rows = await R.knex("better_auth_twofactor").select("userId");

        if (rows.length > 0) {
            const users = await R.knex("better_auth_user")
                .whereIn(
                    "id",
                    rows.map((row) => row.userId)
                )
                .select("username", "email");

            names.push(...users.map((user) => user.username || user.email));
            await R.knex("better_auth_twofactor").del();
            await R.knex("better_auth_user").update({ twoFactorEnabled: false });
        }
    }

    if (names.length === 0) {
        console.log("2FA is not enabled on any user.");
        await cleanUp();
        return;
    }

    console.log(`Removed 2FA for: ${names.join(", ")}`);
    console.log("Sign in again without a one-time code.");
    await cleanUp();
}

/**
 * Close the database
 * @returns {Promise<void>}
 */
async function cleanUp() {
    await Database.close();
}

// Gracefully handle Ctrl+C
process.on("SIGINT", async () => {
    console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");
    await cleanUp();
    process.exit(0);
});

try {
    await main();
} catch (e) {
    console.error(e);
    process.exit(1);
}
