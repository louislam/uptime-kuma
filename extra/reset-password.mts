import { APIError } from "better-auth";

console.log("== Uptime Kuma Reset Password Tool ==");

import { loadEnvFile } from "node:process";
import { auth, BetterAuthUser, getGodKumaHeaders, removeOtherGodKumaUsers } from "../server/better-auth";
import { input, password as passwordInput, select } from "@inquirer/prompts";
import { ExitPromptError } from "@inquirer/core";
import { genSecret, isDevEnv } from "../src/util";

// @ts-ignore
import Database from "../server/database.js";

// @ts-ignore No type package is available
import parseArgs from "args-parser";

let kumaGodHeader: Headers;

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

    kumaGodHeader = await getGodKumaHeaders(false);

    const result = await auth().api.listUsers({
        query: {},
        headers: kumaGodHeader,
    });

    const choices = result.users.map((user) => {
        const email = user.email;
        const username = (user as BetterAuthUser).username || email;

        return {
            name: username,
            value: email,
            description: "",
        };
    });

    let email: string;

    while (true) {
        const selectEmail = await select({
            message: "Select a username:",
            choices,
        });

        if (!selectEmail) {
            console.log("Invalid choice");
            continue;
        }

        email = selectEmail;
        break;
    }

    while (true) {
        const password = await passwordInput({
            message: "Enter new password:",
            mask: "*",
        });

        try {
            const ok = await auth().api.setUserPassword({
                body: {
                    userId: email,
                    newPassword: password,
                },
                headers: kumaGodHeader,
            });

            if (ok) {
                console.log("Password reset succesfully!");
                break;
            }
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
    if (kumaGodHeader) {
        // Better Auth is not allow to remove current user, so leave it as is first...
    }
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
