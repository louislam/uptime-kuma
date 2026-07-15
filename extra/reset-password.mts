console.log("== Uptime Kuma Reset Password Tool ==");

import { loadEnvFile } from "node:process";
import { auth } from "../server/better-auth";
import { password as passwordInput, select } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import { isDevEnv } from "../src/util";
import { hashPassword } from "better-auth/crypto";

// @ts-ignore
import Database from "../server/database.js";

// @ts-ignore No type package is available
import parseArgs from "args-parser";

/**
 *
 */
async function main() {
    const args = parseArgs(process.argv);
    try {
        loadEnvFile();
    } catch { }

    console.log("Dev Environment:", isDevEnv());

    Database.initDataDir(args);
    await Database.connect();

    const context = await auth().$context;
    const internalAdapter = context.internalAdapter;

    const users = await internalAdapter.listUsers();
    const choices = users.map((user) => {
        const userId = user.id;
        const username = user.name || user.email;

        return {
            name: username,
            value: userId,
            description: "",
        };
    });

    let userId: string;

    while (true) {
        const selectedUserId = await select({
            message: "Select a username:",
            choices,
        });

        if (!selectedUserId) {
            console.log("Invalid choice");
            continue;
        }

        userId = selectedUserId;
        break;
    }

    while (true) {
        const password = await passwordInput({
            message: "Enter new password:",
            mask: "*",
        });

        try {
            const hash = await hashPassword(password); // We do that because the method under doesn't hash the password (it stores it in plain text)
            await internalAdapter.updatePassword(userId, hash);

            console.log("Password reset succesfully!");
            break;
        } catch (_) {
            // Better Auth shows Cli error message in cli already, we don't need to
        }
    }

    await cleanUp();
}

/**
 *
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
    // Ignore prompt exit errors
    if (!(e instanceof ExitPromptError)) {
        throw e;
    }
}
