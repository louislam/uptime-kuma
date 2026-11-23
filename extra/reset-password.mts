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
    } catch {}

    console.log("Dev Environment:", isDevEnv());

    Database.initDataDir(args);
    await Database.connect();

    const context = await auth().$context;
    const internalAdapter = context.internalAdapter;

    const users = await internalAdapter.listUsers();

    /** Non-interactive path, same as the 2.x tool: --new-password=<password> */
    const requestedPassword: string | undefined = args["new-password"];

    let userId: string;

    if (requestedPassword) {
        const user = users[0];

        if (!user) {
            console.error("user not found, have you installed?");
            process.exit(1);
        }

        console.log("Found user: " + (user.name || user.email));
        console.warn(
            "\x1b[31m%s\x1b[0m",
            "Warning: the password might be stored, in plain text, in your shell's history"
        );

        userId = user.id;
    } else {
        const choices = users.map((user) => {
            const userId = user.id;
            const username = user.name || user.email;

            return {
                name: username,
                value: userId,
                description: "",
            };
        });

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
    }

    if (requestedPassword) {
        const hash = await hashPassword(requestedPassword); // We do that because the method under doesn't hash the password (it stores it in plain text)
        await internalAdapter.updatePassword(userId, hash);
        console.log("Password reset successfully.");
    } else {
        while (true) {
            const password = await passwordInput({
                message: "Enter new password:",
                mask: "*",
            });

            try {
                const hash = await hashPassword(password); // We do that because the method under doesn't hash the password (it stores it in plain text)
                await internalAdapter.updatePassword(userId, hash);

                console.log("Password reset successfully.");
                break;
            } catch (_) {
                // Better Auth shows Cli error message in cli already, we don't need to
            }
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
